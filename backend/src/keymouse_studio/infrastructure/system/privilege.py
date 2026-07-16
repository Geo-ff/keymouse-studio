from __future__ import annotations

import ctypes
import sys
from ctypes import wintypes
from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol


class IntegrityLevel(StrEnum):
    UNKNOWN = "unknown"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    SYSTEM = "system"


PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
TOKEN_QUERY = 0x0008
TOKEN_INTEGRITY_LEVEL = 25
GA_ROOT = 2


class SID_AND_ATTRIBUTES(ctypes.Structure):
    _fields_ = [
        ("Sid", ctypes.c_void_p),
        ("Attributes", wintypes.DWORD),
    ]


class TOKEN_MANDATORY_LABEL(ctypes.Structure):
    _fields_ = [("Label", SID_AND_ATTRIBUTES)]


def integrity_level_from_rid(rid: int) -> IntegrityLevel:
    if rid >= 0x4000:
        return IntegrityLevel.SYSTEM
    if rid >= 0x3000:
        return IntegrityLevel.HIGH
    if rid >= 0x2000:
        return IntegrityLevel.MEDIUM
    if rid >= 0x1000:
        return IntegrityLevel.LOW
    return IntegrityLevel.UNKNOWN


def can_inject(current: IntegrityLevel, target: IntegrityLevel) -> bool:
    rank = {
        IntegrityLevel.UNKNOWN: -1,
        IntegrityLevel.LOW: 0,
        IntegrityLevel.MEDIUM: 1,
        IntegrityLevel.HIGH: 2,
        IntegrityLevel.SYSTEM: 3,
    }
    # Unknown integrity cannot be treated as injectable (elevated targets often fail token query).
    if current is IntegrityLevel.UNKNOWN or target is IntegrityLevel.UNKNOWN:
        return False
    return rank[current] >= rank[target]


@dataclass(frozen=True, slots=True)
class PrivilegeCheckResult:
    process_integrity: IntegrityLevel
    foreground_integrity: IntegrityLevel | None
    can_inject: bool
    target_integrity: IntegrityLevel | None = None
    reason: str | None = None


class PrivilegeChecker(Protocol):
    def check(
        self,
        *,
        x: int | None = None,
        y: int | None = None,
    ) -> PrivilegeCheckResult: ...


@dataclass(frozen=True, slots=True)
class FakePrivilegeChecker:
    result: PrivilegeCheckResult

    def check(
        self,
        *,
        x: int | None = None,
        y: int | None = None,
    ) -> PrivilegeCheckResult:
        return self.result


class AlwaysAllowPrivilegeChecker:
    def check(
        self,
        *,
        x: int | None = None,
        y: int | None = None,
    ) -> PrivilegeCheckResult:
        return PrivilegeCheckResult(
            process_integrity=IntegrityLevel.MEDIUM,
            foreground_integrity=IntegrityLevel.MEDIUM,
            target_integrity=IntegrityLevel.MEDIUM,
            can_inject=True,
        )


class WindowsPrivilegeChecker:
    def check(
        self,
        *,
        x: int | None = None,
        y: int | None = None,
    ) -> PrivilegeCheckResult:
        if sys.platform != "win32":
            return PrivilegeCheckResult(
                process_integrity=IntegrityLevel.UNKNOWN,
                foreground_integrity=None,
                can_inject=True,
            )
        process_level = self._process_integrity()
        our_pid = ctypes.windll.kernel32.GetCurrentProcessId()
        foreground_level, foreground_pid = self._window_integrity(
            ctypes.windll.user32.GetForegroundWindow()
        )
        point_x, point_y = self._resolve_point(x, y)
        point_level, point_pid = self._window_integrity(self._window_from_point(point_x, point_y))

        candidates: list[tuple[str, IntegrityLevel | None, int | None]] = [
            ("point", point_level, point_pid),
            ("foreground", foreground_level, foreground_pid),
        ]
        blocked_level: IntegrityLevel | None = None
        blocked_reason: str | None = None
        for source, level, pid in candidates:
            if pid is None or pid == our_pid:
                continue
            if level is None or level is IntegrityLevel.UNKNOWN:
                # Cannot read integrity (common for protected/elevated targets) → block.
                blocked_level = level or IntegrityLevel.UNKNOWN
                blocked_reason = f"{source}_unreadable"
                break
            if not can_inject(process_level, level):
                blocked_level = level
                blocked_reason = f"{source}_integrity_higher"
                break

        if blocked_reason is not None:
            return PrivilegeCheckResult(
                process_integrity=process_level,
                foreground_integrity=foreground_level,
                target_integrity=blocked_level,
                can_inject=False,
                reason=blocked_reason,
            )
        return PrivilegeCheckResult(
            process_integrity=process_level,
            foreground_integrity=foreground_level,
            target_integrity=point_level or foreground_level,
            can_inject=True,
        )

    def _resolve_point(self, x: int | None, y: int | None) -> tuple[int, int]:
        if x is not None and y is not None:
            return x, y
        point = wintypes.POINT()
        if ctypes.windll.user32.GetCursorPos(ctypes.byref(point)):
            return int(point.x), int(point.y)
        return 0, 0

    def _window_from_point(self, x: int, y: int) -> int:
        point = wintypes.POINT(x, y)
        hwnd = ctypes.windll.user32.WindowFromPoint(point)
        if not hwnd:
            return 0
        root = ctypes.windll.user32.GetAncestor(hwnd, GA_ROOT)
        return int(root or hwnd)

    def _window_integrity(self, hwnd: int) -> tuple[IntegrityLevel | None, int | None]:
        if not hwnd:
            return None, None
        process_id = wintypes.DWORD()
        ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(process_id))
        pid = int(process_id.value)
        if pid <= 0:
            return None, None
        process = ctypes.windll.kernel32.OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION, False, pid
        )
        if not process:
            return IntegrityLevel.UNKNOWN, pid
        return self._process_integrity(process), pid

    def _process_integrity(self, process_handle: int | None = None) -> IntegrityLevel:
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
                return IntegrityLevel.UNKNOWN
            size = wintypes.DWORD()
            advapi32.GetTokenInformation(token, TOKEN_INTEGRITY_LEVEL, None, 0, ctypes.byref(size))
            if size.value == 0:
                return IntegrityLevel.UNKNOWN
            buffer = ctypes.create_string_buffer(size.value)
            if not advapi32.GetTokenInformation(
                token, TOKEN_INTEGRITY_LEVEL, buffer, size, ctypes.byref(size)
            ):
                return IntegrityLevel.UNKNOWN
            label = ctypes.cast(buffer, ctypes.POINTER(TOKEN_MANDATORY_LABEL)).contents
            sid_pointer = label.Label.Sid
            if not sid_pointer:
                return IntegrityLevel.UNKNOWN
            count = advapi32.GetSidSubAuthorityCount(sid_pointer).contents.value
            rid = advapi32.GetSidSubAuthority(sid_pointer, count - 1).contents.value
            return integrity_level_from_rid(rid)
        except OSError:
            return IntegrityLevel.UNKNOWN
        finally:
            if token:
                kernel32.CloseHandle(token)
            if close_process and process_handle is not None:
                kernel32.CloseHandle(process_handle)


def create_privilege_checker() -> PrivilegeChecker:
    if sys.platform == "win32":
        return WindowsPrivilegeChecker()
    return AlwaysAllowPrivilegeChecker()
