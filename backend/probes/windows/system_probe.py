from __future__ import annotations

import ctypes
import sys
from ctypes import wintypes
from dataclasses import dataclass
from typing import Any

from probes.windows.display_probe import Display, VirtualBounds, layout_digest
from probes.windows.privilege_probe import IntegrityLevel, integrity_level_from_rid

PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
TOKEN_QUERY = 0x0008
TOKEN_INTEGRITY_LEVEL = 25
SM_XVIRTUALSCREEN = 76
SM_YVIRTUALSCREEN = 77
SM_CXVIRTUALSCREEN = 78
SM_CYVIRTUALSCREEN = 79
MONITORINFOF_PRIMARY = 1


class MONITORINFOEXW(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.DWORD),
        ("rcMonitor", wintypes.RECT),
        ("rcWork", wintypes.RECT),
        ("dwFlags", wintypes.DWORD),
        ("szDevice", wintypes.WCHAR * 32),
    ]


@dataclass(frozen=True, slots=True)
class SystemSnapshot:
    dpi_awareness_enabled: bool
    bounds: VirtualBounds
    displays: tuple[Display, ...]
    layout_digest: str
    process_integrity: IntegrityLevel
    foreground_integrity: IntegrityLevel | None


def enable_per_monitor_dpi_awareness() -> bool:
    if sys.platform != "win32":
        return False
    shcore = ctypes.windll.shcore
    result = shcore.SetProcessDpiAwareness(2)
    return result in (0, -2147024891)


def enumerate_displays() -> tuple[Display, ...]:
    displays: list[Display] = []
    callback_type = ctypes.WINFUNCTYPE(
        wintypes.BOOL,
        wintypes.HMONITOR,
        wintypes.HDC,
        ctypes.POINTER(wintypes.RECT),
        wintypes.LPARAM,
    )

    def callback(
        monitor: int,
        device_context: int,
        rectangle: Any,
        data: int,
    ) -> bool:
        info = MONITORINFOEXW(cbSize=ctypes.sizeof(MONITORINFOEXW))
        if not ctypes.windll.user32.GetMonitorInfoW(monitor, ctypes.byref(info)):
            return False
        displays.append(
            Display(
                device_name=info.szDevice,
                left=info.rcMonitor.left,
                top=info.rcMonitor.top,
                width=info.rcMonitor.right - info.rcMonitor.left,
                height=info.rcMonitor.bottom - info.rcMonitor.top,
                primary=bool(info.dwFlags & MONITORINFOF_PRIMARY),
            )
        )
        return True

    if not ctypes.windll.user32.EnumDisplayMonitors(None, None, callback_type(callback), 0):
        raise ctypes.WinError()
    return tuple(displays)


def virtual_bounds() -> VirtualBounds:
    get_metric = ctypes.windll.user32.GetSystemMetrics
    return VirtualBounds(
        left=get_metric(SM_XVIRTUALSCREEN),
        top=get_metric(SM_YVIRTUALSCREEN),
        width=get_metric(SM_CXVIRTUALSCREEN),
        height=get_metric(SM_CYVIRTUALSCREEN),
    )


def process_integrity(process_handle: int | None = None) -> IntegrityLevel:
    kernel32 = ctypes.windll.kernel32
    advapi32 = ctypes.windll.advapi32
    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL
    advapi32.OpenProcessToken.argtypes = [
        wintypes.HANDLE,
        wintypes.DWORD,
        ctypes.POINTER(wintypes.HANDLE),
    ]
    advapi32.OpenProcessToken.restype = wintypes.BOOL
    advapi32.GetTokenInformation.argtypes = [
        wintypes.HANDLE,
        ctypes.c_int,
        ctypes.c_void_p,
        wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD),
    ]
    advapi32.GetTokenInformation.restype = wintypes.BOOL
    advapi32.GetSidSubAuthorityCount.argtypes = [ctypes.c_void_p]
    advapi32.GetSidSubAuthorityCount.restype = ctypes.POINTER(ctypes.c_ubyte)
    advapi32.GetSidSubAuthority.argtypes = [ctypes.c_void_p, wintypes.DWORD]
    advapi32.GetSidSubAuthority.restype = ctypes.POINTER(wintypes.DWORD)
    close_process = process_handle is not None
    handle = (
        wintypes.HANDLE(process_handle)
        if process_handle is not None
        else kernel32.GetCurrentProcess()
    )
    token = wintypes.HANDLE()
    try:
        if not advapi32.OpenProcessToken(handle, TOKEN_QUERY, ctypes.byref(token)):
            raise ctypes.WinError()
        size = wintypes.DWORD()
        advapi32.GetTokenInformation(token, TOKEN_INTEGRITY_LEVEL, None, 0, ctypes.byref(size))
        buffer = ctypes.create_string_buffer(size.value)
        if not advapi32.GetTokenInformation(
            token, TOKEN_INTEGRITY_LEVEL, buffer, size, ctypes.byref(size)
        ):
            raise ctypes.WinError()
        sid_pointer = ctypes.cast(buffer, ctypes.POINTER(ctypes.c_void_p)).contents.value
        count = advapi32.GetSidSubAuthorityCount(sid_pointer).contents.value
        rid = advapi32.GetSidSubAuthority(sid_pointer, count - 1).contents.value
        return integrity_level_from_rid(rid)
    finally:
        if token:
            kernel32.CloseHandle(token)
        if close_process:
            kernel32.CloseHandle(handle)


def foreground_process_integrity() -> IntegrityLevel | None:
    process_id = wintypes.DWORD()
    window = ctypes.windll.user32.GetForegroundWindow()
    if not window:
        return None
    ctypes.windll.user32.GetWindowThreadProcessId(window, ctypes.byref(process_id))
    process = ctypes.windll.kernel32.OpenProcess(
        PROCESS_QUERY_LIMITED_INFORMATION, False, process_id.value
    )
    if not process:
        return None
    return process_integrity(process)


def snapshot() -> SystemSnapshot:
    dpi_enabled = enable_per_monitor_dpi_awareness()
    displays = enumerate_displays()
    return SystemSnapshot(
        dpi_awareness_enabled=dpi_enabled,
        bounds=virtual_bounds(),
        displays=displays,
        layout_digest=layout_digest(list(displays)),
        process_integrity=process_integrity(),
        foreground_integrity=foreground_process_integrity(),
    )