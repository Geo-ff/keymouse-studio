import asyncio
import sys
from types import SimpleNamespace

import pytest

from keymouse_studio.domain.enums import MouseButton
from keymouse_studio.infrastructure.input.listener import (
    FakeInputListener,
    InputEventBridge,
    PynputInputListener,
    RawInputEvent,
)


@pytest.mark.asyncio
async def test_bridge_transfers_thread_events_to_async_subscriber() -> None:
    listener = FakeInputListener()
    bridge = InputEventBridge(listener, capacity=2, subscriber_capacity=2)
    subscriber = bridge.subscribe()
    await bridge.start()

    listener.emit(RawInputEvent("key_down", 1, key_code="a"))
    event = await asyncio.wait_for(subscriber.get(), timeout=1)

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
    await asyncio.sleep(0.02)

    events = []
    while not subscriber.empty():
        event = subscriber.get_nowait()
        if event is not None:
            events.append(event)
    edges = [
        (event.type, event.key_code, event.button) for event in events if event.type != "mouse_move"
    ]
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
    expected = []

    async def consume() -> list[tuple[str, str | None]]:
        received = []
        for _ in range(200):
            event = await subscriber.get()
            assert isinstance(event, RawInputEvent)
            received.append((event.type, event.key_code))
        return received

    consumer = asyncio.create_task(consume())
    for index in range(200):
        key = "f12" if index == 100 else f"vk_{index}"
        event_type = "key_down" if index % 2 == 0 else "key_up"
        expected.append((event_type, key))
        listener.emit(RawInputEvent(event_type, index, key_code=key))
    received = await asyncio.wait_for(consumer, timeout=2)

    assert received == expected
    assert ("key_down", "f12") in received
    assert bridge.failure is None
    await bridge.stop()


class FakeThreadListener:
    def __init__(self, fail_start: bool = False, **callbacks: object) -> None:
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
        listener = FakeThreadListener(**callbacks)
        created.append(listener)
        return listener

    def mouse_listener(**callbacks: object) -> FakeThreadListener:
        listener = FakeThreadListener(fail_start=True, **callbacks)
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
