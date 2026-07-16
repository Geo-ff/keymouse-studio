"""Windows per-monitor DPI awareness bootstrap.

Must run before any coordinate APIs (GetCursorPos / SendInput / pynput)
so recorded and injected positions share the same physical pixel space.
"""

from __future__ import annotations

import ctypes
import sys


def enable_per_monitor_dpi_awareness() -> bool:
    if sys.platform != "win32":
        return False
    try:
        # PROCESS_PER_MONITOR_DPI_AWARE = 2 (Windows 8.1+)
        result = ctypes.windll.shcore.SetProcessDpiAwareness(2)
        # S_OK (0) or E_ACCESSDENIED (-2147024891) if already set
        return int(result) in (0, -2147024891)
    except (AttributeError, OSError):
        pass
    try:
        # Fallback: system DPI aware
        return bool(ctypes.windll.user32.SetProcessDPIAware())
    except (AttributeError, OSError):
        return False