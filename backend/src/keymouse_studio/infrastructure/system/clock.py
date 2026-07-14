import asyncio
import time
from typing import Protocol


class Clock(Protocol):
    def now_ns(self) -> int: ...

    async def sleep(self, seconds: float) -> None: ...


class MonotonicClock:
    def now_ns(self) -> int:
        return time.monotonic_ns()

    async def sleep(self, seconds: float) -> None:
        await asyncio.sleep(seconds)
