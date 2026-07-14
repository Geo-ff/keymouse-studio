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

    def release_all(self) -> ReleaseResult: ...


@dataclass(slots=True)
class FakeInputAdapter:
    actions: list[tuple[str, object]] = field(default_factory=list)
    pressed: set[MouseButton] = field(default_factory=set)
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

    def release_all(self) -> ReleaseResult:
        released_count = len(self.pressed)
        for button in tuple(self.pressed):
            self.button_up(button)
        return ReleaseResult(released_count=released_count)


class InputWorker:
    def __init__(self, adapter: InputAdapter) -> None:
        self._adapter = adapter
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="keymouse-input")

    async def move(self, x: int, y: int) -> None:
        await self._run(self._adapter.move, x, y)

    async def button_down(self, button: MouseButton) -> None:
        await self._run(self._adapter.button_down, button)

    async def button_up(self, button: MouseButton) -> None:
        await self._run(self._adapter.button_up, button)

    async def release_all(self) -> ReleaseResult:
        return await self._run(self._adapter.release_all)

    def close(self) -> None:
        self._executor.shutdown(wait=True, cancel_futures=True)

    async def _run(self, function: Callable[..., T], *args: object) -> T:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, partial(function, *args))
