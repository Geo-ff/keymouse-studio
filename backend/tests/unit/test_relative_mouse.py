import asyncio
import ctypes
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import ClassVar

import pytest

from keymouse_studio.api.schemas.playback import PlaybackRequest
from keymouse_studio.api.schemas.recording import RecordingConfig
from keymouse_studio.api.schemas.scripts import Script
from keymouse_studio.domain.enums import MouseButton, MouseMoveMode
from keymouse_studio.infrastructure.input import send_input
from keymouse_studio.infrastructure.input.adapter import FakeInputAdapter, InputWorker
from keymouse_studio.infrastructure.input.listener import (
    EventSubscription,
    PynputInputListener,
    RawInputEvent,
    ThreadEventBuffer,
)
from keymouse_studio.infrastructure.input.raw_mouse import (
    MOUSE_MOVE_ABSOLUTE,
    RAWINPUT_MOUSE,
    RIM_TYPEMOUSE,
    parse_raw_mouse_delta,
)
from keymouse_studio.infrastructure.input.send_input import SendInputAdapter
from keymouse_studio.infrastructure.persistence.json_script_repository import JsonScriptRepository
from keymouse_studio.infrastructure.system.clock import MonotonicClock
from keymouse_studio.services.action_normalizer import ActionNormalizer
from keymouse_studio.services.event_service import EventService
from keymouse_studio.services.operation_service import OperationService
from keymouse_studio.services.playback_service import PlaybackService
from keymouse_studio.services.script_service import ScriptService

MS = 1_000_000


def relative(ns: int, dx: int, dy: int = 0) -> RawInputEvent:
    return RawInputEvent("mouse_move_relative", ns, delta_x=dx, delta_y=dy)


# --- Raw Input parsing -------------------------------------------------------------------


def raw_mouse_bytes(*, dx: int, dy: int, flags: int = 0, kind: int = RIM_TYPEMOUSE) -> bytes:
    raw = RAWINPUT_MOUSE()
    raw.header.dwType = kind
    raw.header.dwSize = ctypes.sizeof(RAWINPUT_MOUSE)
    raw.mouse.usFlags = flags
    raw.mouse.lLastX = dx
    raw.mouse.lLastY = dy
    return bytes(raw)


def test_raw_mouse_layout_matches_windows_x64() -> None:
    if ctypes.sizeof(ctypes.c_void_p) != 8:
        pytest.skip("layout check targets 64-bit builds")
    assert ctypes.sizeof(RAWINPUT_MOUSE) == 48
    assert RAWINPUT_MOUSE.mouse.offset == 24


def test_parse_raw_mouse_delta_reads_relative_motion() -> None:
    assert parse_raw_mouse_delta(raw_mouse_bytes(dx=5, dy=-3)) == (5, -3)


@pytest.mark.parametrize(
    "data",
    [
        raw_mouse_bytes(dx=100, dy=200, flags=MOUSE_MOVE_ABSOLUTE),  # position, not motion
        raw_mouse_bytes(dx=1, dy=1, kind=1),  # keyboard report
        raw_mouse_bytes(dx=0, dy=0),  # button-only report
        b"\x00" * 8,  # truncated
    ],
)
def test_parse_raw_mouse_delta_ignores_non_motion(data: bytes) -> None:
    assert parse_raw_mouse_delta(data) is None


# --- Queues never drop relative motion ---------------------------------------------------


def test_thread_buffer_sums_consecutive_relative_motion() -> None:
    buffer = ThreadEventBuffer(capacity=1)
    for index in range(10):
        buffer.put(relative(index, 3, -1))
    buffer.put(RawInputEvent("mouse_button_down", 20, button=MouseButton.LEFT))
    buffer.put(relative(21, 7))

    merged = buffer.get()
    assert isinstance(merged, RawInputEvent)
    assert (merged.type, merged.delta_x, merged.delta_y, merged.monotonic_ns) == (
        "mouse_move_relative",
        30,
        -10,
        9,
    )
    assert isinstance(buffer.get(), RawInputEvent)  # button keeps its place
    last = buffer.get()
    assert isinstance(last, RawInputEvent)
    assert last.delta_x == 7


def test_subscription_sums_consecutive_relative_motion() -> None:
    subscription = EventSubscription(capacity=1)
    for index in range(5):
        subscription.put_nowait(relative(index, -2, 4))

    merged = subscription.get_nowait()
    assert isinstance(merged, RawInputEvent)
    assert (merged.delta_x, merged.delta_y) == (-10, 20)
    assert subscription.empty()


# --- pynput listener toggles the raw mouse source ----------------------------------------


class FakeRawMouse:
    instances: ClassVar[list["FakeRawMouse"]] = []

    def __init__(self, on_motion: object) -> None:
        self.on_motion = on_motion
        self.running = False
        FakeRawMouse.instances.append(self)

    def start(self) -> None:
        self.running = True

    def stop(self) -> None:
        self.running = False


class FakeThreadListener:
    def start(self) -> None: ...

    def stop(self) -> None: ...

    def join(self, timeout: float) -> None: ...

    def is_alive(self) -> bool:
        return False


def test_pynput_listener_switches_between_absolute_and_relative_motion(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mouse_options: dict[str, object] = {}

    def mouse_listener(**kwargs: object) -> FakeThreadListener:
        mouse_options.update(kwargs)
        return FakeThreadListener()

    keyboard = SimpleNamespace(
        Key=type("Key", (), {}),
        KeyCode=type("KeyCode", (), {}),
        Listener=lambda **kwargs: FakeThreadListener(),
    )
    mouse = SimpleNamespace(
        Button=SimpleNamespace(left="left", right="right", middle="middle"),
        Listener=mouse_listener,
    )
    monkeypatch.setitem(sys.modules, "pynput", SimpleNamespace(keyboard=keyboard, mouse=mouse))
    monkeypatch.setattr(sys, "platform", "linux")
    FakeRawMouse.instances.clear()
    events: list[RawInputEvent] = []
    source = PynputInputListener(raw_mouse_factory=FakeRawMouse)  # type: ignore[arg-type]

    with pytest.raises(RuntimeError, match="not running"):
        source.set_relative_mouse(True)

    source.start(events.append)
    on_move = mouse_options["on_move"]
    assert callable(on_move)
    on_move(10, 20)
    assert [event.type for event in events] == ["mouse_move"]

    source.set_relative_mouse(True)
    raw = FakeRawMouse.instances[-1]
    assert raw.running
    on_move(11, 21)  # cursor position is ignored while capturing raw motion
    assert callable(raw.on_motion)
    raw.on_motion(4, -2)
    assert [(e.type, e.delta_x, e.delta_y) for e in events[1:]] == [("mouse_move_relative", 4, -2)]

    source.stop()
    assert not raw.running


# --- Recording: raw motion becomes timed relative actions --------------------------------


def relative_config(**overrides: object) -> RecordingConfig:
    values: dict[str, object] = {
        "mouse_move_mode": MouseMoveMode.RELATIVE,
        "min_move_sample_ms": 10,
        **overrides,
    }
    return RecordingConfig.model_validate(values)


def payloads(normalizer: ActionNormalizer) -> list[tuple[int, int, int, int]]:
    result = []
    for action in normalizer.actions:
        assert action.type == "mouse_move_relative"
        payload = action.payload
        result.append((action.delay_before_ms, payload.dx, payload.dy, payload.duration_ms))
    return result


def test_continuous_motion_is_split_into_back_to_back_windows() -> None:
    normalizer = ActionNormalizer(relative_config())
    # 2 ms reports for 30 ms, 2 units right and 1 unit down each.
    for index in range(16):
        normalizer.process(relative(100 * MS + index * 2 * MS, 2, 1))
    normalizer.finish(200 * MS)

    windows = payloads(normalizer)
    assert sum(window[1] for window in windows) == 32
    assert sum(window[2] for window in windows) == 16
    # Windows tile the timeline: no gaps between them and the durations add up.
    assert all(window[0] == 0 for window in windows)
    assert sum(window[3] for window in windows) == 30
    assert [window[3] for window in windows] == [10, 10, 10, 0]


def test_pause_in_motion_becomes_delay_not_slow_motion() -> None:
    normalizer = ActionNormalizer(relative_config())
    normalizer.process(relative(0, 5))
    normalizer.process(relative(2 * MS, 5))
    normalizer.process(relative(500 * MS, -3))  # mouse rested for ~0.5 s
    normalizer.finish(600 * MS)

    assert payloads(normalizer) == [(0, 10, 0, 2), (498, -3, 0, 0)]


def test_relative_motion_flushes_before_clicks() -> None:
    normalizer = ActionNormalizer(relative_config())
    normalizer.process(relative(0, 1))
    normalizer.process(relative(3 * MS, 1))
    normalizer.process(RawInputEvent("mouse_button_down", 5 * MS, button=MouseButton.LEFT))
    normalizer.process(RawInputEvent("mouse_button_up", 50 * MS, button=MouseButton.LEFT))

    assert [action.type for action in normalizer.actions] == [
        "mouse_move_relative",
        "mouse_button_down",
        "mouse_button_up",
    ]
    assert normalizer.actions[1].delay_before_ms == 2


def test_each_mode_ignores_the_other_kind_of_motion() -> None:
    relative_mode = ActionNormalizer(relative_config())
    relative_mode.process(RawInputEvent("mouse_move", 0, x=10, y=10))
    relative_mode.finish(MS)
    assert relative_mode.actions == []

    absolute_mode = ActionNormalizer(RecordingConfig())
    absolute_mode.process(relative(0, 10))
    absolute_mode.finish(MS)
    assert absolute_mode.actions == []

    disabled = ActionNormalizer(relative_config(record_mouse_move=False))
    disabled.process(relative(0, 10))
    disabled.finish(MS)
    assert disabled.actions == []


# --- Playback ----------------------------------------------------------------------------


def relative_script(*payloads: dict[str, int]) -> Script:
    return Script.model_validate(
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "name": "Camera",
            "createdAt": "2026-07-14T00:00:00Z",
            "updatedAt": "2026-07-14T00:00:00Z",
            "settings": {"countdownMs": 0},
            "actions": [
                {
                    "id": f"00000000-0000-0000-0000-00000000001{index}",
                    "type": "mouse_move_relative",
                    "payload": payload,
                }
                for index, payload in enumerate(payloads)
            ],
        }
    )


async def play(script: Script, tmp_path: Path, speed: float = 1.0) -> FakeInputAdapter:
    adapter = FakeInputAdapter()
    worker = InputWorker(adapter)
    service = PlaybackService(
        OperationService(EventService(1)),
        ScriptService(JsonScriptRepository(tmp_path / "scripts")),
        worker,
        MonotonicClock(),
        2,
    )
    await service.start(
        PlaybackRequest(inline_script=script, countdown_ms=0, speed_multiplier=speed)
    )
    await asyncio.wait_for(service.wait_finished(), timeout=2)
    worker.close()
    return adapter


@pytest.mark.asyncio
async def test_relative_move_without_duration_is_one_step(tmp_path: Path) -> None:
    adapter = await play(relative_script({"dx": -120, "dy": 45}), tmp_path)

    assert adapter.actions == [("move_relative", (-120, 45))]


@pytest.mark.asyncio
async def test_relative_move_spreads_exact_distance_over_duration(tmp_path: Path) -> None:
    loop = asyncio.get_running_loop()
    started = loop.time()
    adapter = await play(relative_script({"dx": 101, "dy": -37, "durationMs": 80}), tmp_path)
    elapsed = loop.time() - started

    steps = [delta for kind, delta in adapter.actions if kind == "move_relative"]
    assert isinstance(steps[0], tuple)
    assert len(steps) > 5
    assert sum(step[0] for step in steps) == 101  # type: ignore[index]
    assert sum(step[1] for step in steps) == -37  # type: ignore[index]
    assert elapsed >= 0.08


@pytest.mark.asyncio
async def test_relative_move_duration_scales_with_speed(tmp_path: Path) -> None:
    loop = asyncio.get_running_loop()
    started = loop.time()
    adapter = await play(
        relative_script({"dx": 50, "dy": 0, "durationMs": 400}), tmp_path, speed=10
    )
    elapsed = loop.time() - started

    assert sum(delta[0] for kind, delta in adapter.actions if kind == "move_relative") == 50  # type: ignore[index]
    assert 0.04 <= elapsed < 0.3


# --- SendInput ---------------------------------------------------------------------------


def test_send_input_relative_move_is_not_absolute(monkeypatch: pytest.MonkeyPatch) -> None:
    adapter = SendInputAdapter()
    sent: list[send_input.INPUT] = []
    monkeypatch.setattr(adapter, "_send", sent.append)

    adapter.move_relative(-7, 12)
    adapter.move_relative(0, 0)

    assert len(sent) == 1
    assert (sent[0].mi.dx, sent[0].mi.dy) == (-7, 12)
    assert sent[0].mi.dwFlags == send_input.MOUSEEVENTF_MOVE
