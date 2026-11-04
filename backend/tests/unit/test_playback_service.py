import asyncio
import time
from pathlib import Path

import pytest

from keymouse_studio.api.schemas.operations import StateSnapshot
from keymouse_studio.api.schemas.playback import PlaybackRequest
from keymouse_studio.api.schemas.scripts import Script
from keymouse_studio.domain.enums import EngineState, LoopMode, MouseButton
from keymouse_studio.domain.errors import AppError
from keymouse_studio.infrastructure.input.adapter import (
    FakeInputAdapter,
    InputWorker,
    ReleaseResult,
)
from keymouse_studio.infrastructure.persistence.json_script_repository import JsonScriptRepository
from keymouse_studio.infrastructure.system.clock import MonotonicClock
from keymouse_studio.services.event_service import EventService
from keymouse_studio.services.operation_service import OperationService
from keymouse_studio.services.playback_service import MOUSE_CLICK_HOLD_MS, PlaybackService
from keymouse_studio.services.script_service import ScriptService


class FailingInputAdapter(FakeInputAdapter):
    def wheel(self, delta_x: int, delta_y: int) -> None:
        raise OSError("wheel failed")


class ReleaseFailingInputAdapter(FakeInputAdapter):
    def release_all(self) -> ReleaseResult:
        raise OSError("release failed")


def inline_script() -> Script:
    return Script.model_validate(
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "name": "Playback",
            "createdAt": "2026-07-14T00:00:00Z",
            "updatedAt": "2026-07-14T00:00:00Z",
            "settings": {"countdownMs": 0},
            "actions": [
                {
                    "id": "00000000-0000-0000-0000-000000000002",
                    "type": "key_down",
                    "payload": {"keyCode": "a", "scanCode": 30},
                },
                {
                    "id": "00000000-0000-0000-0000-000000000003",
                    "type": "mouse_wheel",
                    "delayBeforeMs": 1,
                    "payload": {"deltaX": 0, "deltaY": -1},
                },
                {
                    "id": "00000000-0000-0000-0000-000000000004",
                    "type": "key_up",
                    "payload": {"keyCode": "a", "scanCode": 30},
                },
            ],
        }
    )


@pytest.mark.asyncio
async def test_playback_executes_keyboard_wheel_and_progress(tmp_path: Path) -> None:
    adapter = FakeInputAdapter()
    worker = InputWorker(adapter)
    operations = OperationService(EventService(1))
    scripts = ScriptService(JsonScriptRepository(tmp_path / "scripts"))
    service = PlaybackService(operations, scripts, worker, MonotonicClock(), 2)

    transition = await service.start(PlaybackRequest(inline_script=inline_script(), countdown_ms=0))
    await asyncio.wait_for(service.wait_finished(), timeout=1)

    assert transition.state == EngineState.RUNNING
    assert ("key_down", ("a", 30, False)) in adapter.actions
    assert ("wheel", (0, -1)) in adapter.actions
    assert ("key_up", ("a", 30, False)) in adapter.actions
    assert adapter.pressed_keys == set()
    assert operations.state == EngineState.IDLE
    worker.close()


@pytest.mark.asyncio
async def test_worker_release_all_releases_keyboard_and_mouse() -> None:
    adapter = FakeInputAdapter()
    worker = InputWorker(adapter)
    await worker.button_down(MouseButton.LEFT)
    await worker.key_down("a", 30, False)

    result = await worker.release_all()

    assert result.released_count == 2
    assert adapter.pressed == set()
    assert adapter.pressed_keys == set()
    worker.close()


@pytest.mark.asyncio
async def test_playback_pause_preserves_remaining_wait(tmp_path: Path) -> None:
    adapter = FakeInputAdapter()
    worker = InputWorker(adapter)
    operations = OperationService(EventService(1))
    scripts = ScriptService(JsonScriptRepository(tmp_path / "scripts"))
    service = PlaybackService(operations, scripts, worker, MonotonicClock(), 2)
    script = inline_script().model_copy(
        update={"actions": [inline_script().actions[1].model_copy(update={"delay_before_ms": 80})]}
    )

    transition = await service.start(PlaybackRequest(inline_script=script, countdown_ms=0))
    await asyncio.sleep(0.01)
    await service.pause(transition.operation_id)
    await asyncio.sleep(0.09)

    assert adapter.actions == []
    assert operations.state == EngineState.PAUSED
    await service.resume(transition.operation_id)
    await asyncio.wait_for(service.wait_finished(), timeout=1)
    assert adapter.actions == [("wheel", (0, -1))]
    worker.close()


@pytest.mark.asyncio
async def test_playback_failure_releases_pressed_input_and_publishes_error(
    tmp_path: Path,
) -> None:
    adapter = FailingInputAdapter()
    worker = InputWorker(adapter)
    events = EventService(1)
    subscriber = events.subscribe()
    operations = OperationService(events)
    scripts = ScriptService(JsonScriptRepository(tmp_path / "scripts"))
    service = PlaybackService(operations, scripts, worker, MonotonicClock(), 2)

    await service.start(PlaybackRequest(inline_script=inline_script(), countdown_ms=0))
    await asyncio.wait_for(service.wait_finished(), timeout=1)
    event_types = []
    while not subscriber.empty():
        event_types.append(subscriber.get_nowait().type)

    assert "error.raised" in event_types
    assert adapter.pressed_keys == set()
    assert operations.state == EngineState.IDLE
    worker.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("case", ["empty", "disabled", "zero_wait"])
async def test_playback_rejects_scripts_without_enabled_actions(
    tmp_path: Path,
    case: str,
) -> None:
    script = inline_script().model_copy(update={"actions": []})
    if case == "disabled":
        script = inline_script().model_copy(
            update={"actions": [inline_script().actions[0].model_copy(update={"enabled": False})]}
        )
    elif case == "zero_wait":
        data = inline_script().model_dump(mode="json", by_alias=True)
        data["actions"] = [
            {
                "id": "00000000-0000-0000-0000-000000000011",
                "type": "wait",
                "payload": {"durationMs": 0},
            }
        ]
        script = Script.model_validate(data)
    worker = InputWorker(FakeInputAdapter())
    operations = OperationService(EventService(1))
    service = PlaybackService(
        operations,
        ScriptService(JsonScriptRepository(tmp_path / "scripts")),
        worker,
        MonotonicClock(),
        2,
    )

    with pytest.raises(AppError) as exc_info:
        await service.start(
            PlaybackRequest(
                inline_script=script,
                loop_mode=LoopMode.INFINITE,
                countdown_ms=0,
            )
        )

    assert exc_info.value.status_code == 422
    assert operations.state == EngineState.IDLE
    worker.close()


@pytest.mark.asyncio
async def test_loop_duration_excludes_countdown_and_publishes_final_progress(
    tmp_path: Path,
) -> None:
    worker = InputWorker(FakeInputAdapter())
    events = EventService(1)
    subscriber = events.subscribe()
    operations = OperationService(events)
    service = PlaybackService(
        operations,
        ScriptService(JsonScriptRepository(tmp_path / "scripts")),
        worker,
        MonotonicClock(),
        2,
    )
    data = inline_script().model_dump(mode="json", by_alias=True)
    data["actions"] = [
        {
            "id": "00000000-0000-0000-0000-000000000010",
            "type": "wait",
            "payload": {"durationMs": 1000},
        }
    ]
    script = Script.model_validate(data)
    before = asyncio.get_running_loop().time()

    await service.start(
        PlaybackRequest(
            inline_script=script,
            loop_mode=LoopMode.INFINITE,
            loop_duration_ms=30,
            countdown_ms=20,
        )
    )
    await asyncio.wait_for(service.wait_finished(), timeout=1)
    wall_ms = (asyncio.get_running_loop().time() - before) * 1000
    snapshots = []
    while not subscriber.empty():
        event = subscriber.get_nowait()
        if event.type == "operation.progress":
            snapshots.append(event.payload)
    final = snapshots[-1]
    assert isinstance(final, StateSnapshot)

    assert wall_ms >= 45
    assert final.progress == 1.0
    assert final.completed_count == 0
    assert final.current_action_index is None
    assert 25 <= final.elapsed_ms <= 80
    worker.close()


@pytest.mark.asyncio
async def test_count_playback_final_progress_tracks_completed_loops(tmp_path: Path) -> None:
    worker = InputWorker(FakeInputAdapter())
    events = EventService(1)
    subscriber = events.subscribe()
    operations = OperationService(events)
    service = PlaybackService(
        operations,
        ScriptService(JsonScriptRepository(tmp_path / "scripts")),
        worker,
        MonotonicClock(),
        2,
    )

    await service.start(
        PlaybackRequest(
            inline_script=inline_script(),
            loop_mode=LoopMode.COUNT,
            loop_count=2,
            countdown_ms=0,
        )
    )
    await service.wait_finished()
    snapshots = []
    while not subscriber.empty():
        event = subscriber.get_nowait()
        if event.type == "operation.progress":
            snapshots.append(event.payload)
    final = snapshots[-1]
    assert isinstance(final, StateSnapshot)

    assert final.completed_count == 2
    assert final.progress == 1.0
    assert final.current_action_index == 2
    worker.close()


@pytest.mark.asyncio
async def test_release_failure_does_not_block_playback_state_cleanup(tmp_path: Path) -> None:
    worker = InputWorker(ReleaseFailingInputAdapter())
    operations = OperationService(EventService(1))
    service = PlaybackService(
        operations,
        ScriptService(JsonScriptRepository(tmp_path / "scripts")),
        worker,
        MonotonicClock(),
        2,
    )

    transition = await service.start(PlaybackRequest(inline_script=inline_script(), countdown_ms=0))
    await service.wait_finished()
    release = service.release_result(transition.operation_id)

    assert release.failures == ("release_all:OSError",)
    assert operations.state == EngineState.IDLE
    worker.close()


@pytest.mark.asyncio
async def test_long_wait_publishes_smooth_progress_before_completion(
    tmp_path: Path,
) -> None:
    worker = InputWorker(FakeInputAdapter())
    events = EventService(1)
    subscriber = events.subscribe()
    operations = OperationService(events)
    service = PlaybackService(
        operations,
        ScriptService(JsonScriptRepository(tmp_path / "scripts")),
        worker,
        MonotonicClock(),
        5,
    )
    data = inline_script().model_dump(mode="json", by_alias=True)
    data["actions"] = [
        {
            "id": "00000000-0000-0000-0000-000000000012",
            "type": "wait",
            "payload": {"durationMs": 500},
        }
    ]

    await service.start(
        PlaybackRequest(
            inline_script=Script.model_validate(data),
            loop_mode=LoopMode.COUNT,
            loop_count=1,
            countdown_ms=0,
        )
    )
    await asyncio.wait_for(service.wait_finished(), timeout=1)

    progress_values = []
    while not subscriber.empty():
        event = subscriber.get_nowait()
        if event.type == "operation.progress" and event.payload.progress is not None:
            progress_values.append(event.payload.progress)
    intermediate = [value for value in progress_values if 0 < value < 1]
    assert intermediate
    assert intermediate == sorted(intermediate)
    assert progress_values[-1] == 1.0
    worker.close()


class TimelineInputAdapter(FakeInputAdapter):
    def __init__(self) -> None:
        super().__init__()
        self.timeline: list[tuple[str, int]] = []

    def button_down(self, button: MouseButton) -> None:
        self.timeline.append(("down", time.monotonic_ns()))
        super().button_down(button)

    def button_up(self, button: MouseButton) -> None:
        self.timeline.append(("up", time.monotonic_ns()))
        super().button_up(button)


@pytest.mark.asyncio
async def test_mouse_click_action_holds_button_even_at_high_speed(tmp_path: Path) -> None:
    adapter = TimelineInputAdapter()
    worker = InputWorker(adapter)
    operations = OperationService(EventService(1))
    scripts = ScriptService(JsonScriptRepository(tmp_path / "scripts"))
    service = PlaybackService(operations, scripts, worker, MonotonicClock(), 2)
    script = Script.model_validate(
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "name": "Click",
            "createdAt": "2026-07-14T00:00:00Z",
            "updatedAt": "2026-07-14T00:00:00Z",
            "settings": {"countdownMs": 0},
            "actions": [
                {
                    "id": "00000000-0000-0000-0000-000000000002",
                    "type": "mouse_click",
                    "payload": {"button": "left", "clickCount": 2},
                }
            ],
        }
    )

    await service.start(PlaybackRequest(inline_script=script, countdown_ms=0, speed_multiplier=10))
    await asyncio.wait_for(service.wait_finished(), timeout=1)

    assert [kind for kind, _ in adapter.timeline] == ["down", "up", "down", "up"]
    stamps = [stamp for _, stamp in adapter.timeline]
    hold_ns = MOUSE_CLICK_HOLD_MS * 1_000_000
    # Held while pressed, and the two presses stay apart even though intervalMs is 0.
    assert stamps[1] - stamps[0] >= hold_ns
    assert stamps[2] - stamps[1] >= hold_ns
    assert stamps[3] - stamps[2] >= hold_ns
    assert adapter.pressed == set()
    worker.close()


@pytest.mark.asyncio
async def test_playback_rejects_chord_key_actions_before_starting(tmp_path: Path) -> None:
    adapter = FakeInputAdapter()
    worker = InputWorker(adapter)
    operations = OperationService(EventService(1))
    scripts = ScriptService(JsonScriptRepository(tmp_path / "scripts"))
    service = PlaybackService(operations, scripts, worker, MonotonicClock(), 2)
    script = Script.model_validate(
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "name": "Copy",
            "createdAt": "2026-07-14T00:00:00Z",
            "updatedAt": "2026-07-14T00:00:00Z",
            "settings": {"countdownMs": 0},
            "actions": [
                {
                    "id": "00000000-0000-0000-0000-000000000002",
                    "type": "key_down",
                    "payload": {"keyCode": "Enter"},
                },
                {
                    "id": "00000000-0000-0000-0000-000000000003",
                    "type": "key_down",
                    "enabled": False,
                    "payload": {"keyCode": "Alt+Tab"},
                },
                {
                    "id": "00000000-0000-0000-0000-000000000004",
                    "type": "key_up",
                    "payload": {"keyCode": "Ctrl+C"},
                },
            ],
        }
    )

    with pytest.raises(AppError) as raised:
        await service.start(PlaybackRequest(inline_script=script, countdown_ms=0))

    assert raised.value.status_code == 422
    assert "第 3 个动作" in raised.value.message
    assert "Ctrl+C" in raised.value.message
    assert raised.value.details["actionIndex"] == 2
    # Nothing was pressed and no operation is left running.
    assert adapter.actions == []
    assert operations.state == EngineState.IDLE
    worker.close()


@pytest.mark.asyncio
async def test_start_delay_waits_while_running_and_publishes_remaining(tmp_path: Path) -> None:
    adapter = TimelineInputAdapter()
    worker = InputWorker(adapter)
    events = EventService(1)
    operations = OperationService(events)
    scripts = ScriptService(JsonScriptRepository(tmp_path / "scripts"))
    service = PlaybackService(operations, scripts, worker, MonotonicClock(), 5)
    queue = events.subscribe()
    script = Script.model_validate(
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "name": "Scheduled",
            "createdAt": "2026-07-14T00:00:00Z",
            "updatedAt": "2026-07-14T00:00:00Z",
            "settings": {"countdownMs": 0},
            "actions": [
                {
                    "id": "00000000-0000-0000-0000-000000000002",
                    "type": "mouse_button_down",
                    "payload": {"button": "left"},
                },
                {
                    "id": "00000000-0000-0000-0000-000000000003",
                    "type": "mouse_button_up",
                    "payload": {"button": "left"},
                },
            ],
        }
    )
    started_ns = time.monotonic_ns()

    transition = await service.start(
        PlaybackRequest(inline_script=script, countdown_ms=0, start_delay_ms=120)
    )
    await asyncio.wait_for(service.wait_finished(), timeout=2)

    # No full-screen countdown state: the scheduled wait happens while "running".
    assert transition.state == EngineState.RUNNING
    first_press_ns = adapter.timeline[0][1]
    assert first_press_ns - started_ns >= 120 * 1_000_000
    remaining = []
    while not queue.empty():
        event = queue.get_nowait()
        if event.type == "operation.progress":
            remaining.append(event.payload.countdown_remaining_ms)
    assert remaining and max(remaining) > 0
    assert operations.state == EngineState.IDLE
    worker.close()


def _position_script(actions: list[dict[str, object]]) -> Script:
    return Script.model_validate(
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "name": "Return",
            "createdAt": "2026-07-14T00:00:00Z",
            "updatedAt": "2026-07-14T00:00:00Z",
            "settings": {"countdownMs": 0},
            "actions": [
                {"id": f"00000000-0000-0000-0000-0000000001{index:02d}", **action}
                for index, action in enumerate(actions)
            ],
        }
    )


@pytest.mark.asyncio
async def test_restore_returns_cursor_to_playback_start_or_last_saved_position(
    tmp_path: Path,
) -> None:
    adapter = FakeInputAdapter(position=(640, 360))
    worker = InputWorker(adapter)
    operations = OperationService(EventService(1))
    scripts = ScriptService(JsonScriptRepository(tmp_path / "scripts"))
    service = PlaybackService(operations, scripts, worker, MonotonicClock(), 2)
    move = lambda x, y: {"type": "mouse_move", "payload": {"x": x, "y": y}}  # noqa: E731

    # Without an explicit save, restore goes back to where playback started.
    await service.start(
        PlaybackRequest(
            inline_script=_position_script(
                [move(10, 10), {"type": "mouse_position_restore", "payload": {}}]
            ),
            countdown_ms=0,
        )
    )
    await asyncio.wait_for(service.wait_finished(), timeout=1)
    assert adapter.actions[-1] == ("move", (640, 360))

    # An explicit save replaces the remembered position (payload may be omitted).
    adapter.actions.clear()
    await service.start(
        PlaybackRequest(
            inline_script=_position_script(
                [
                    move(100, 200),
                    {"type": "mouse_position_save"},
                    move(5, 5),
                    {"type": "mouse_position_restore"},
                ]
            ),
            countdown_ms=0,
        )
    )
    await asyncio.wait_for(service.wait_finished(), timeout=1)
    assert [a for a in adapter.actions if a[0] == "move"] == [
        ("move", (100, 200)),
        ("move", (5, 5)),
        ("move", (100, 200)),
    ]
    worker.close()
