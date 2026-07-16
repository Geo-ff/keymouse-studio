import asyncio
import time
from collections import deque
from collections.abc import Callable
from contextlib import suppress
from dataclasses import dataclass
from threading import Condition, Lock
from typing import Literal, Protocol, cast

from keymouse_studio.domain.enums import MouseButton

RawEventType = Literal[
    "mouse_move",
    "mouse_button_down",
    "mouse_button_up",
    "mouse_wheel",
    "key_down",
    "key_up",
]


@dataclass(frozen=True, slots=True)
class RawInputEvent:
    type: RawEventType
    monotonic_ns: int
    x: int | None = None
    y: int | None = None
    button: MouseButton | None = None
    delta_x: int = 0
    delta_y: int = 0
    key_code: str | None = None
    scan_code: int | None = None
    extended: bool = False


class InputListener(Protocol):
    def start(self, emit: Callable[[RawInputEvent], None]) -> None: ...

    def stop(self) -> None: ...


class ThreadListener(Protocol):
    def start(self) -> None: ...

    def stop(self) -> None: ...

    def join(self, timeout: float) -> None: ...

    def is_alive(self) -> bool: ...


@dataclass(slots=True)
class FakeInputListener:
    _emit: Callable[[RawInputEvent], None] | None = None
    started: bool = False

    def start(self, emit: Callable[[RawInputEvent], None]) -> None:
        self._emit = emit
        self.started = True

    def stop(self) -> None:
        self.started = False
        self._emit = None

    def emit(self, event: RawInputEvent) -> None:
        if self._emit is not None:
            self._emit(event)


class PynputInputListener:
    def __init__(self) -> None:
        self._keyboard: ThreadListener | None = None
        self._mouse: ThreadListener | None = None

    def start(self, emit: Callable[[RawInputEvent], None]) -> None:
        from pynput import keyboard, mouse

        def key_data(key: keyboard.Key | keyboard.KeyCode) -> str:
            if isinstance(key, keyboard.KeyCode):
                if key.char is not None:
                    return str(key.char).lower()
                return f"vk_{key.vk}"
            name = key.name
            return str(name) if name is not None else str(key)

        def on_press(key: keyboard.Key | keyboard.KeyCode) -> None:
            emit(RawInputEvent("key_down", time.monotonic_ns(), key_code=key_data(key)))

        def on_release(key: keyboard.Key | keyboard.KeyCode) -> None:
            emit(RawInputEvent("key_up", time.monotonic_ns(), key_code=key_data(key)))

        def cursor_pos(fallback_x: int, fallback_y: int) -> tuple[int, int]:
            """Prefer GetCursorPos so coords match SendInput / virtual desktop."""
            try:
                import ctypes
                from ctypes import wintypes

                point = wintypes.POINT()
                if ctypes.windll.user32.GetCursorPos(ctypes.byref(point)):
                    return int(point.x), int(point.y)
            except Exception:
                pass
            return int(fallback_x), int(fallback_y)

        def on_move(x: int, y: int) -> None:
            cx, cy = cursor_pos(x, y)
            emit(RawInputEvent("mouse_move", time.monotonic_ns(), x=cx, y=cy))

        def on_click(x: int, y: int, button: mouse.Button, pressed: bool) -> None:
            mapped = {
                mouse.Button.left: MouseButton.LEFT,
                mouse.Button.right: MouseButton.RIGHT,
                mouse.Button.middle: MouseButton.MIDDLE,
            }.get(button)
            if mapped is not None:
                event_type: RawEventType = "mouse_button_down" if pressed else "mouse_button_up"
                cx, cy = cursor_pos(x, y)
                emit(RawInputEvent(event_type, time.monotonic_ns(), x=cx, y=cy, button=mapped))

        def on_scroll(x: int, y: int, dx: int, dy: int) -> None:
            cx, cy = cursor_pos(x, y)
            emit(
                RawInputEvent(
                    "mouse_wheel",
                    time.monotonic_ns(),
                    x=cx,
                    y=cy,
                    delta_x=dx,
                    delta_y=dy,
                )
            )

        keyboard_listener = cast(
            ThreadListener,
            keyboard.Listener(on_press=on_press, on_release=on_release),
        )
        mouse_listener = cast(
            ThreadListener,
            mouse.Listener(on_move=on_move, on_click=on_click, on_scroll=on_scroll),
        )
        try:
            keyboard_listener.start()
            mouse_listener.start()
        except Exception:
            for listener in (mouse_listener, keyboard_listener):
                with suppress(Exception):
                    listener.stop()
            for listener in (mouse_listener, keyboard_listener):
                with suppress(Exception):
                    listener.join(1)
            self._keyboard = None
            self._mouse = None
            raise
        self._keyboard = keyboard_listener
        self._mouse = mouse_listener

    def stop(self) -> None:
        listeners = (self._keyboard, self._mouse)
        self._keyboard = None
        self._mouse = None
        failures: list[Exception] = []
        for listener in listeners:
            if listener is not None:
                try:
                    listener.stop()
                except Exception as exc:
                    failures.append(exc)
        for listener in listeners:
            if listener is not None:
                try:
                    listener.join(1)
                    if listener.is_alive():
                        failures.append(RuntimeError("Input listener thread did not stop"))
                except Exception as exc:
                    failures.append(exc)
        if failures:
            raise failures[0]


class EventQueueOverflow(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class SubscriptionBarrier:
    reached: asyncio.Future[None]


class EventSubscription:
    def __init__(self, capacity: int) -> None:
        self._capacity = capacity
        self._events: deque[RawInputEvent | SubscriptionBarrier | None] = deque()
        self._available = asyncio.Event()
        self._closed = False
        self.coalesced_move_count = 0
        self.dropped_move_count = 0

    def put_nowait(self, event: RawInputEvent) -> None:
        if self._closed:
            return
        if event.type == "mouse_move" and self._events:
            last = self._events[-1]
            if isinstance(last, RawInputEvent) and last.type == "mouse_move":
                self._events[-1] = event
                self.coalesced_move_count += 1
                self._available.set()
                return
        move_count = sum(
            isinstance(queued, RawInputEvent) and queued.type == "mouse_move"
            for queued in self._events
        )
        if event.type == "mouse_move" and move_count >= self._capacity:
            move_index = next(
                (
                    index
                    for index, queued in enumerate(self._events)
                    if isinstance(queued, RawInputEvent) and queued.type == "mouse_move"
                ),
                None,
            )
            if move_index is None:
                self.dropped_move_count += 1
                return
            del self._events[move_index]
            self.dropped_move_count += 1
        self._events.append(event)
        self._available.set()

    async def get(self) -> RawInputEvent | SubscriptionBarrier | None:
        while not self._events:
            self._available.clear()
            await self._available.wait()
        event = self._events.popleft()
        if not self._events:
            self._available.clear()
        return event

    def get_nowait(self) -> RawInputEvent | SubscriptionBarrier | None:
        if not self._events:
            raise asyncio.QueueEmpty
        event = self._events.popleft()
        if not self._events:
            self._available.clear()
        return event

    def empty(self) -> bool:
        return not self._events

    def barrier(self, reached: asyncio.Future[None]) -> None:
        self._events.append(SubscriptionBarrier(reached))
        self._available.set()

    def close(self) -> None:
        if not self._closed:
            self._closed = True
            for event in self._events:
                if isinstance(event, SubscriptionBarrier) and not event.reached.done():
                    event.reached.set_exception(
                        RuntimeError("Input event subscription closed before synchronization")
                    )
            self._events.append(None)
            self._available.set()


@dataclass(frozen=True, slots=True)
class BridgeBarrier:
    subscriber: EventSubscription
    reached: asyncio.Future[None]
    drain: bool


class ThreadEventBuffer:
    def __init__(self, capacity: int) -> None:
        self._capacity = capacity
        self._events: deque[RawInputEvent | BridgeBarrier | None] = deque()
        self._condition = Condition(Lock())
        self.coalesced_move_count = 0
        self.dropped_move_count = 0
        self.failure: EventQueueOverflow | None = None

    def put(self, event: RawInputEvent) -> None:
        with self._condition:
            if self.failure is not None:
                return
            if event.type == "mouse_move" and self._events:
                last = self._events[-1]
                if isinstance(last, RawInputEvent) and last.type == "mouse_move":
                    self._events[-1] = event
                    self.coalesced_move_count += 1
                    self._condition.notify()
                    return
            move_count = sum(
                isinstance(queued, RawInputEvent) and queued.type == "mouse_move"
                for queued in self._events
            )
            if event.type == "mouse_move" and move_count >= self._capacity:
                move_index = next(
                    (
                        index
                        for index, queued in enumerate(self._events)
                        if isinstance(queued, RawInputEvent) and queued.type == "mouse_move"
                    ),
                    None,
                )
                if move_index is None:
                    self.dropped_move_count += 1
                    return
                del self._events[move_index]
                self.dropped_move_count += 1
            self._events.append(event)
            self._condition.notify()

    def barrier(
        self,
        subscriber: EventSubscription,
        reached: asyncio.Future[None],
        drain: bool,
    ) -> None:
        with self._condition:
            self._events.append(BridgeBarrier(subscriber, reached, drain))
            self._condition.notify()

    def stop(self) -> None:
        with self._condition:
            self._events.append(None)
            self._condition.notify()

    def get(self) -> RawInputEvent | BridgeBarrier | None:
        with self._condition:
            while not self._events:
                self._condition.wait()
            return self._events.popleft()


class InputEventBridge:
    def __init__(
        self,
        listener: InputListener,
        capacity: int = 4096,
        subscriber_capacity: int = 1024,
    ) -> None:
        self.listener = listener
        self.capacity = capacity
        self.subscriber_capacity = subscriber_capacity
        self._raw = ThreadEventBuffer(capacity)
        self._subscribers: set[EventSubscription] = set()
        self._task: asyncio.Task[None] | None = None
        self._ready = asyncio.Event()
        self.failure: Exception | None = None

    @property
    def coalesced_move_count(self) -> int:
        return self._raw.coalesced_move_count + sum(
            subscriber.coalesced_move_count for subscriber in self._subscribers
        )

    @property
    def dropped_move_count(self) -> int:
        return self._raw.dropped_move_count + sum(
            subscriber.dropped_move_count for subscriber in self._subscribers
        )

    async def start(self) -> None:
        if self._task is not None:
            return
        self._task = asyncio.create_task(self._pump(), name="input-event-bridge")
        await self._ready.wait()
        try:
            self.listener.start(self._raw.put)
        except Exception:
            with suppress(Exception):
                self.listener.stop()
            self._raw.stop()
            await self._task
            self._task = None
            raise

    async def stop(self) -> None:
        listener_error: Exception | None = None
        try:
            self.listener.stop()
        except Exception as exc:
            listener_error = exc
        self._raw.stop()
        if self._task is not None:
            try:
                await self._task
            finally:
                self._task = None
        if listener_error is not None:
            raise listener_error

    def subscribe(self) -> EventSubscription:
        result = EventSubscription(self.subscriber_capacity)
        self._subscribers.add(result)
        return result

    def unsubscribe(self, subscriber: EventSubscription, *, drain: bool = False) -> None:
        self._subscribers.discard(subscriber)
        if drain:
            subscriber.close()

    async def drain_and_unsubscribe(self, subscriber: EventSubscription) -> None:
        loop = asyncio.get_running_loop()
        reached: asyncio.Future[None] = loop.create_future()
        self._raw.barrier(subscriber, reached, True)
        bridge_task = self._task
        if bridge_task is None:
            self.unsubscribe(subscriber, drain=True)
            raise RuntimeError("Input event bridge is not running")
        done, _ = await asyncio.wait(
            {reached, bridge_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        if reached not in done:
            self.unsubscribe(subscriber, drain=True)
            raise self.failure or RuntimeError("Input event bridge stopped before drain")
        await reached

    async def synchronize(self, subscriber: EventSubscription) -> None:
        loop = asyncio.get_running_loop()
        reached: asyncio.Future[None] = loop.create_future()
        self._raw.barrier(subscriber, reached, False)
        bridge_task = self._task
        if bridge_task is None:
            raise RuntimeError("Input event bridge is not running")
        done, _ = await asyncio.wait(
            {reached, bridge_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        if reached not in done:
            raise self.failure or RuntimeError("Input event bridge stopped before synchronization")
        await reached

    async def _pump(self) -> None:
        self._ready.set()
        while True:
            event = await asyncio.to_thread(self._raw.get)
            if event is None:
                if self._raw.failure is not None:
                    self.failure = self._raw.failure
                return
            if isinstance(event, BridgeBarrier):
                if event.drain:
                    self.unsubscribe(event.subscriber, drain=True)
                    if not event.reached.done():
                        event.reached.set_result(None)
                else:
                    event.subscriber.barrier(event.reached)
                continue
            try:
                for subscriber in tuple(self._subscribers):
                    subscriber.put_nowait(event)
            except EventQueueOverflow as exc:
                self.failure = exc
                for subscriber in tuple(self._subscribers):
                    self.unsubscribe(subscriber, drain=True)
                return
