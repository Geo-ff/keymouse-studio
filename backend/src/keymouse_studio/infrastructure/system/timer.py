"""Windows timer resolution control.

By default Windows wakes sleeping threads on a ~15.6 ms tick, so every short ``asyncio.sleep``
in playback overshoots by up to a tick. For scripts made of many small steps (recorded mouse
motion) that error accumulates and replays noticeably slower than recorded. Raising the timer
resolution to 1 ms for the duration of a playback keeps timing faithful; it is released again
as soon as playback ends.
"""

from __future__ import annotations

import ctypes
import sys
from collections.abc import Iterator
from contextlib import contextmanager, suppress
from typing import Any

TIMERR_NOERROR = 0


@contextmanager
def high_resolution_timer(period_ms: int = 1) -> Iterator[None]:
    winmm: Any = None
    if sys.platform == "win32":
        try:
            library = ctypes.WinDLL("winmm")
            if library.timeBeginPeriod(period_ms) == TIMERR_NOERROR:
                winmm = library
        except (AttributeError, OSError):
            winmm = None
    try:
        yield
    finally:
        if winmm is not None:
            with suppress(Exception):
                winmm.timeEndPeriod(period_ms)
