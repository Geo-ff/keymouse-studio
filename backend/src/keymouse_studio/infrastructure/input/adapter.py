import asyncio
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from functools import partial
from threading import Event
from typing import Protocol, TypeVar

from keymouse_studio.domain.enums import MouseButton

T = TypeVar("T")


@dataclass(frozen=True, slots=True)
class ReleaseResult:
    released_count: int = 0
    failures: tuple[str, ...] = ()


class InputAdapter(Protocol):
    def move(self, x: int, y: int) -> None: ...

    def button_down(self, button: MouseButton) -> None: ...

    def button_up(self, button: MouseButton) -> None: ...

    def wheel(self, delta_x: int, delta_y: int) -> None: ...

    def key_down(self, key_code: str, scan_code: int | None, extended: bool) -> None: ...

    def key_up(self, key_code: str, scan_code: int | None, extended: bool) -> None: ...

    def release_all(self) -> ReleaseResult: ...


@dataclass(slots=True)
class FakeInputAdapter:
    actions: list[tuple[str, object]] = field(default_factory=list)
    pressed: set[MouseButton] = field(default_factory=set)
    pressed_keys: set[tuple[str, int | None, bool]] = field(default_factory=set)
    action_recorded: Event = field(default_factory=Event)

    def move(self, x: int, y: int) -> None:
        self.actions.append(("move", (x, y)))
        self.action_recorded.set()

    def button_down(self, button: MouseButton) -> None:
        self.actions.append(("down", button))
        self.pressed.add(button)
        self.action_recorded.set()

    def button_up(self, button: MouseButton) -> None:
        self.actions.append(("up", button))
        self.pressed.discard(button)
        self.action_recorded.set()

    def wheel(self, delta_x: int, delta_y: int) -> None:
        self.actions.append(("wheel", (delta_x, delta_y)))
        self.action_recorded.set()

    def key_down(self, key_code: str, scan_code: int | None, extended: bool) -> None:
        key = (key_code, scan_code, extended)
        self.actions.append(("key_down", key))
        self.pressed_keys.add(key)
        self.action_recorded.set()

    def key_up(self, key_code: str, scan_code: int | None, extended: bool) -> None:
        key = (key_code, scan_code, extended)
        self.actions.append(("key_up", key))
        self.pressed_keys.discard(key)
        self.action_recorded.set()

    def release_all(self) -> ReleaseResult:
        released_count = len(self.pressed) + len(self.pressed_keys)
        for button in tuple(self.pressed):
            self.button_up(button)
        for key_code, scan_code, extended in tuple(self.pressed_keys):
            self.key_up(key_code, scan_code, extended)
        return ReleaseResult(released_count=released_count)


class InputWorker:
    def __init__(self, adapter: InputAdapter) -> None:
        self._adapter = adapter
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="keymouse-input")
        self._closed = False

    async def move(self, x: int, y: int) -> None:
        await self._run(self._adapter.move, x, y)

    async def button_down(self, button: MouseButton) -> None:
        await self._run(self._adapter.button_down, button)

    async def button_up(self, button: MouseButton) -> None:
        await self._run(self._adapter.button_up, button)

    async def wheel(self, delta_x: int, delta_y: int) -> None:
        await self._run(self._adapter.wheel, delta_x, delta_y)

    async def key_down(self, key_code: str, scan_code: int | None, extended: bool) -> None:
        await self._run(self._adapter.key_down, key_code, scan_code, extended)

    async def key_up(self, key_code: str, scan_code: int | None, extended: bool) -> None:
        await self._run(self._adapter.key_up, key_code, scan_code, extended)

    async def release_all(self) -> ReleaseResult:
        return await self._run(self._adapter.release_all)

    def close(self) -> None:
        if not self._closed:
            self._executor.shutdown(wait=True, cancel_futures=True)
            self._closed = True

    async def _run(self, function: Callable[..., T], *args: object) -> T:
        if self._closed:
            raise RuntimeError("Input worker is closed")
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, partial(function, *args))
