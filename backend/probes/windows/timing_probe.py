from __future__ import annotations

from dataclasses import dataclass

NANOSECONDS_PER_MILLISECOND = 1_000_000


@dataclass(slots=True)
class PausableDeadline:
    remaining_ns: int
    last_resumed_ns: int
    paused: bool = False

    @classmethod
    def start(cls, duration_ms: int, now_ns: int) -> PausableDeadline:
        if duration_ms < 0:
            raise ValueError("duration_ms must not be negative")
        return cls(duration_ms * NANOSECONDS_PER_MILLISECOND, now_ns)

    def pause(self, now_ns: int) -> None:
        if self.paused:
            return
        self._consume_elapsed(now_ns)
        self.paused = True

    def resume(self, now_ns: int) -> None:
        if not self.paused:
            return
        self.last_resumed_ns = now_ns
        self.paused = False

    def remaining_ms(self, now_ns: int) -> int:
        remaining = self.remaining_ns
        if not self.paused:
            remaining = max(0, remaining - max(0, now_ns - self.last_resumed_ns))
        return (remaining + NANOSECONDS_PER_MILLISECOND - 1) // NANOSECONDS_PER_MILLISECOND

    def _consume_elapsed(self, now_ns: int) -> None:
        elapsed = max(0, now_ns - self.last_resumed_ns)
        self.remaining_ns = max(0, self.remaining_ns - elapsed)
        self.last_resumed_ns = now_ns