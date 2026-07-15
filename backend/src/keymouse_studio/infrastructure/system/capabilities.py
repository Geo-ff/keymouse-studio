import ctypes
import platform
import sys
from ctypes import wintypes
from dataclasses import dataclass
from typing import Literal, Protocol

CapabilityStatus = Literal["available", "unavailable"]


@dataclass(frozen=True, slots=True)
class CapabilityCheck:
    status: CapabilityStatus
    reason: str | None = None


@dataclass(frozen=True, slots=True)
class CapabilitySnapshot:
    platform: str
    platform_version: str
    input: CapabilityCheck
    global_hotkey: CapabilityCheck
    display: CapabilityCheck
    display_count: int | None
    dpi_awareness: CapabilityCheck


class CapabilityDetector(Protocol):
    def detect(self) -> CapabilitySnapshot: ...


@dataclass(frozen=True, slots=True)
class FakeCapabilityDetector:
    snapshot: CapabilitySnapshot

    def detect(self) -> CapabilitySnapshot:
        return self.snapshot


class SystemCapabilityDetector:
    def detect(self) -> CapabilitySnapshot:
        if sys.platform != "win32":
            reason = "Capability detection is only implemented for Windows"
            unavailable = CapabilityCheck("unavailable", reason)
            return CapabilitySnapshot(
                platform=platform.system().lower() or "unknown",
                platform_version=platform.version(),
                input=unavailable,
                global_hotkey=unavailable,
                display=unavailable,
                display_count=None,
                dpi_awareness=unavailable,
            )
        return self._detect_windows()

    def _detect_windows(self) -> CapabilitySnapshot:
        input_check = CapabilityCheck(
            "unavailable",
            "Input permission cannot be reliably verified without injecting real input",
        )
        hotkey_check = self._hotkey_check()
        display_check, display_count = self._display_check()
        dpi_check = self._dpi_check()
        return CapabilitySnapshot(
            platform="windows",
            platform_version=platform.version(),
            input=input_check,
            global_hotkey=hotkey_check,
            display=display_check,
            display_count=display_count,
            dpi_awareness=dpi_check,
        )

    def _hotkey_check(self) -> CapabilityCheck:
        identifier = 0x4B4D
        try:
            user32 = ctypes.windll.user32
            registered = bool(user32.RegisterHotKey(None, identifier, 0x4000, 0x7B))
            if registered:
                user32.UnregisterHotKey(None, identifier)
        except (AttributeError, OSError):
            return CapabilityCheck("unavailable", "Windows hotkey registration is unavailable")
        if not registered:
            return CapabilityCheck("unavailable", "Emergency hotkey is already registered")
        return CapabilityCheck("available")

    def _display_check(self) -> tuple[CapabilityCheck, int | None]:
        try:
            count = int(ctypes.windll.user32.GetSystemMetrics(80))
        except (AttributeError, OSError, ValueError):
            return CapabilityCheck("unavailable", "Windows display metrics are unavailable"), None
        if count <= 0:
            return CapabilityCheck("unavailable", "No active Windows displays were detected"), None
        return CapabilityCheck("available"), count

    def _dpi_check(self) -> CapabilityCheck:
        try:
            awareness = wintypes.HANDLE()
            get_context = ctypes.windll.user32.GetThreadDpiAwarenessContext
            get_awareness = ctypes.windll.user32.GetAwarenessFromDpiAwarenessContext
            context = get_context()
            if not context:
                return CapabilityCheck("unavailable", "DPI awareness context is unavailable")
            awareness = get_awareness(context)
        except (AttributeError, OSError):
            return CapabilityCheck("unavailable", "Windows DPI awareness detection is unavailable")
        if int(awareness) < 1:
            return CapabilityCheck("unavailable", "Process is not DPI aware")
        return CapabilityCheck("available")