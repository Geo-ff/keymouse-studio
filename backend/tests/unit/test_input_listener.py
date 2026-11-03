import asyncio
import sys
from types import SimpleNamespace

import pytest

from keymouse_studio.domain.enums import MouseButton
from keymouse_studio.infrastructure.input.listener import (
    FakeInputListener,
    InputEventBridge,
    PynputInputListener,
    RawEventType,
    RawInputEvent,
    ScanCodeTracker,
)


@pytest.mark.asyncio
async def test_bridge_transfers_thread_events_to_async_subscriber() -> None:
    listener = FakeInputListener()
    bridge = InputEventBridge(listener, capacity=2, subscriber_capacity=2)
    subscriber = bridge.subscribe()
    await bridge.start()

    listener.emit(RawInputEvent("key_down", 1, key_code="a"))
    event = await asyncio.wait_for(subscriber.get(), timeout=1)

    assert isinstance(event, RawInputEvent)
    assert event.key_code == "a"
    await bridge.stop()
    assert not listener.started


@pytest.mark.asyncio
async def test_move_pressure_preserves_f12_and_input_edges() -> None:
    listener = FakeInputListener()
    bridge = InputEventBridge(listener, capacity=4, subscriber_capacity=4)
    subscriber = bridge.subscribe()
    await bridge.start()

    for index in range(1000):
        listener.emit(RawInputEvent("mouse_move", index, x=index, y=index))
    listener.emit(RawInputEvent("key_down", 1001, key_code="a"))
    listener.emit(RawInputEvent("mouse_button_down", 1002, button=MouseButton.LEFT))
    listener.emit(RawInputEvent("key_down", 1003, key_code="f12"))

    async def collect_edges() -> list[tuple[str, str | None, MouseButton | None]]:
        edges: list[tuple[str, str | None, MouseButton | None]] = []
        while len(edges) < 3:
            event = await subscriber.get()
            if isinstance(event, RawInputEvent) and event.type != "mouse_move":
                edges.append((event.type, event.key_code, event.button))
        return edges

    edges = await asyncio.wait_for(collect_edges(), timeout=2)
    assert edges == [
        ("key_down", "a", None),
        ("mouse_button_down", None, MouseButton.LEFT),
        ("key_down", "f12", None),
    ]
    assert bridge.coalesced_move_count + bridge.dropped_move_count > 0
    assert bridge.failure is None
    await bridge.stop()


@pytest.mark.asyncio
async def test_critical_edge_pressure_preserves_order_and_f12() -> None:
    listener = FakeInputListener()
    bridge = InputEventBridge(listener, capacity=1, subscriber_capacity=1)
    subscriber = bridge.subscribe()
    await bridge.start()
    expected: list[tuple[str, str | None]] = []

    async def consume() -> list[tuple[str, str | None]]:
        received: list[tuple[str, str | None]] = []
        for _ in range(200):
            event = await subscriber.get()
            assert isinstance(event, RawInputEvent)
            received.append((event.type, event.key_code))
        return received

    consumer = asyncio.create_task(consume())
    for index in range(200):
        key = "f12" if index == 100 else f"vk_{index}"
        event_type: RawEventType = "key_down" if index % 2 == 0 else "key_up"
        expected.append((event_type, key))
        listener.emit(RawInputEvent(event_type, index, key_code=key))
    received = await asyncio.wait_for(consumer, timeout=2)

    assert received == expected
    assert ("key_down", "f12") in received
    assert bridge.failure is None
    await bridge.stop()


class FakeThreadListener:
    def __init__(self, *, fail_start: bool = False, **callbacks: object) -> None:
        self.fail_start = fail_start
        self.stopped = False
        self.joined = False

    def start(self) -> None:
        if self.fail_start:
            raise RuntimeError("mouse start failed")

    def stop(self) -> None:
        self.stopped = True

    def join(self, timeout: float) -> None:
        self.joined = True

    def is_alive(self) -> bool:
        return False


@pytest.mark.asyncio
async def test_partial_pynput_start_rolls_back_keyboard(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created: list[FakeThreadListener] = []

    def keyboard_listener(**callbacks: object) -> FakeThreadListener:
        listener = FakeThreadListener()
        created.append(listener)
        return listener

    def mouse_listener(**callbacks: object) -> FakeThreadListener:
        listener = FakeThreadListener(fail_start=True)
        created.append(listener)
        return listener

    keyboard = SimpleNamespace(
        Key=type("Key", (), {}),
        KeyCode=type("KeyCode", (), {}),
        Listener=keyboard_listener,
    )
    button = SimpleNamespace(left="left", right="right", middle="middle")
    mouse = SimpleNamespace(Button=button, Listener=mouse_listener)
    monkeypatch.setitem(sys.modules, "pynput", SimpleNamespace(keyboard=keyboard, mouse=mouse))
    source = PynputInputListener()
    bridge = InputEventBridge(source)

    with pytest.raises(RuntimeError, match="mouse start failed"):
        await bridge.start()

    assert len(created) == 2
    assert created[0].stopped
    assert created[0].joined
    assert created[1].stopped
    assert created[1].joined


def test_scan_code_tracker_records_scan_and_extended_flag() -> None:
    tracker = ScanCodeTracker()
    tracker.observe(0x41, 0x1E, 0)
    tracker.observe(0x25, 0x4B, 0x01)
    tracker.observe(0xE7, 0x61, 0)  # VK_PACKET carries a character, not a scan code
    tracker.observe(0xB3, 0, 0)

    assert tracker.lookup(0x41) == (0x1E, False)
    assert tracker.lookup(0x25) == (0x4B, True)
    assert tracker.lookup(0xE7) == (None, False)
    assert tracker.lookup(0xB3) == (None, False)
    assert tracker.lookup(None) == (None, False)


def test_pynput_listener_attaches_hook_scan_codes_to_key_events(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Key:
        def __init__(self, name: str, vk: int) -> None:
            self.name = name
            self.value = SimpleNamespace(vk=vk)

    class KeyCode:
        def __init__(self, vk: int, char: str | None) -> None:
            self.vk = vk
            self.char = char

    options: dict[str, object] = {}

    def keyboard_listener(**kwargs: object) -> FakeThreadListener:
        options.update(kwargs)
        return FakeThreadListener()

    keyboard = SimpleNamespace(Key=Key, KeyCode=KeyCode, Listener=keyboard_listener)
    mouse = SimpleNamespace(
        Button=SimpleNamespace(left="left", right="right", middle="middle"),
        Listener=lambda **kwargs: FakeThreadListener(),
    )
    monkeypatch.setitem(sys.modules, "pynput", SimpleNamespace(keyboard=keyboard, mouse=mouse))
    monkeypatch.setattr(sys, "platform", "win32")
    events: list[RawInputEvent] = []

    source = PynputInputListener()
    source.start(events.append)
    hook_filter = options["win32_event_filter"]
    on_press = options["on_press"]
    on_release = options["on_release"]
    assert callable(hook_filter) and callable(on_press) and callable(on_release)

    assert hook_filter(0x100, SimpleNamespace(vkCode=0x41, scanCode=0x1E, flags=0)) is True
    on_press(KeyCode(0x41, "a"))
    assert hook_filter(0x101, SimpleNamespace(vkCode=0x25, scanCode=0x4B, flags=0x01)) is True
    on_release(Key("left", 0x25))
    on_press(KeyCode(0xB3, None))  # never seen by the hook filter → no scan code

    assert [(e.type, e.key_code, e.scan_code, e.extended) for e in events] == [
        ("key_down", "a", 0x1E, False),
        ("key_up", "left", 0x4B, True),
        ("key_down", "vk_179", None, False),
    ]
