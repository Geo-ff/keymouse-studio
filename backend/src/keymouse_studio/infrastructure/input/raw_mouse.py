"""Relative mouse motion capture through the Windows Raw Input API.

Games that use the mouse for camera control hide and lock the cursor, so the cursor
position seen by low-level hooks (pynput) carries no useful motion. Raw Input reports the
device's own motion (``lLastX`` / ``lLastY``) regardless of the cursor, which is exactly what
those games consume and what ``SendInput`` without ``MOUSEEVENTF_ABSOLUTE`` reproduces.

The listener owns a message-only window on its own thread and registers it with
``RIDEV_INPUTSINK`` so motion is received while another application (the game) is focused.
"""

from __future__ import annotations

import ctypes
import threading
from collections.abc import Callable
from ctypes import wintypes
from typing import Any

WM_DESTROY = 0x0002
WM_CLOSE = 0x0010
WM_INPUT = 0x00FF
RIM_TYPEMOUSE = 0
RID_INPUT = 0x10000003
RIDEV_REMOVE = 0x00000001
RIDEV_INPUTSINK = 0x00000100
MOUSE_MOVE_ABSOLUTE = 0x01
HWND_MESSAGE = -3
HID_USAGE_PAGE_GENERIC = 0x01
HID_USAGE_GENERIC_MOUSE = 0x02
START_TIMEOUT_SECONDS = 2.0


class RAWINPUTHEADER(ctypes.Structure):
    _fields_ = [
        ("dwType", ctypes.c_uint32),
        ("dwSize", ctypes.c_uint32),
        ("hDevice", ctypes.c_void_p),
        ("wParam", ctypes.c_size_t),
    ]


class RAWMOUSE(ctypes.Structure):
    _fields_ = [
        ("usFlags", ctypes.c_uint16),
        # union { ULONG ulButtons; struct { USHORT usButtonFlags; USHORT usButtonData; }; }
        ("ulButtons", ctypes.c_uint32),
        ("ulRawButtons", ctypes.c_uint32),
        ("lLastX", ctypes.c_int32),
        ("lLastY", ctypes.c_int32),
        ("ulExtraInformation", ctypes.c_uint32),
    ]


class RAWINPUT_MOUSE(ctypes.Structure):
    _fields_ = [("header", RAWINPUTHEADER), ("mouse", RAWMOUSE)]


class RAWINPUTDEVICE(ctypes.Structure):
    _fields_ = [
        ("usUsagePage", ctypes.c_uint16),
        ("usUsage", ctypes.c_uint16),
        ("dwFlags", ctypes.c_uint32),
        ("hwndTarget", ctypes.c_void_p),
    ]


def parse_raw_mouse_delta(data: bytes) -> tuple[int, int] | None:
    """Return the relative motion of a ``RAWINPUT`` buffer, or None if it carries none.

    Absolute reports (pen tablets, remote desktop, absolute ``SendInput``) are ignored: they
    describe a position, not motion.
    """
    size = ctypes.sizeof(RAWINPUT_MOUSE)
    if len(data) < size:
        return None
    raw = RAWINPUT_MOUSE.from_buffer_copy(data[:size])
    if raw.header.dwType != RIM_TYPEMOUSE:
        return None
    if raw.mouse.usFlags & MOUSE_MOVE_ABSOLUTE:
        return None
    dx, dy = int(raw.mouse.lLastX), int(raw.mouse.lLastY)
    if not dx and not dy:
        return None
    return dx, dy


class RawMouseListener:
    """Background Raw Input sink that reports ``(dx, dy)`` for every mouse motion report."""

    def __init__(self, on_motion: Callable[[int, int], None]) -> None:
        self._on_motion = on_motion
        self._thread: threading.Thread | None = None
        self._ready = threading.Event()
        self._hwnd: int | None = None
        self._error: BaseException | None = None
        self._user32: Any = None

    def start(self) -> None:
        if self._thread is not None:
            return
        self._ready.clear()
        self._error = None
        thread = threading.Thread(target=self._run, name="keymouse-raw-mouse", daemon=True)
        self._thread = thread
        thread.start()
        if not self._ready.wait(START_TIMEOUT_SECONDS):
            self.stop()
            raise RuntimeError("Raw mouse listener did not start in time")
        if self._error is not None:
            error = self._error
            thread.join(1)
            self._thread = None
            raise RuntimeError(f"Raw mouse listener failed to start: {error}") from error

    def stop(self) -> None:
        thread = self._thread
        self._thread = None
        if thread is None:
            return
        hwnd = self._hwnd
        if hwnd and self._user32 is not None:
            self._user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)
        thread.join(2)
        if thread.is_alive():
            raise RuntimeError("Raw mouse listener thread did not stop")

    def _run(self) -> None:
        try:
            user32, kernel32, wndproc_type = _load_api()
            self._user32 = user32
        except BaseException as exc:
            self._error = exc
            self._ready.set()
            return

        def window_proc(hwnd: int, message: int, wparam: int, lparam: int) -> int:
            try:
                if message == WM_INPUT:
                    self._handle_input(user32, lparam)
                elif message == WM_CLOSE:
                    user32.DestroyWindow(hwnd)
                    return 0
                elif message == WM_DESTROY:
                    user32.PostQuitMessage(0)
                    return 0
            except Exception:
                # Never let an exception unwind into the Windows message dispatcher.
                pass
            return int(user32.DefWindowProcW(hwnd, message, wparam, lparam))

        # Keep a reference to the callback for the lifetime of the window.
        callback = wndproc_type(window_proc)
        instance = kernel32.GetModuleHandleW(None)
        class_name = f"KeyMouseStudioRawMouse{id(self):x}"
        window_class = _wndclass_type()(
            cbSize=ctypes.sizeof(_wndclass_type()),
            lpfnWndProc=callback,
            hInstance=instance,
            lpszClassName=class_name,
        )
        registered_class = False
        hwnd = None
        try:
            if not user32.RegisterClassExW(ctypes.byref(window_class)):
                raise ctypes.WinError(ctypes.get_last_error())
            registered_class = True
            hwnd = user32.CreateWindowExW(
                0, class_name, class_name, 0, 0, 0, 0, 0, HWND_MESSAGE, None, instance, None
            )
            if not hwnd:
                raise ctypes.WinError(ctypes.get_last_error())
            device = RAWINPUTDEVICE(
                HID_USAGE_PAGE_GENERIC, HID_USAGE_GENERIC_MOUSE, RIDEV_INPUTSINK, hwnd
            )
            if not user32.RegisterRawInputDevices(
                ctypes.byref(device), 1, ctypes.sizeof(RAWINPUTDEVICE)
            ):
                raise ctypes.WinError(ctypes.get_last_error())
            self._hwnd = int(hwnd)
        except BaseException as exc:
            self._error = exc
            if hwnd:
                user32.DestroyWindow(hwnd)
            if registered_class:
                user32.UnregisterClassW(class_name, instance)
            self._ready.set()
            return

        self._ready.set()
        message = wintypes.MSG()
        try:
            while user32.GetMessageW(ctypes.byref(message), None, 0, 0) > 0:
                user32.TranslateMessage(ctypes.byref(message))
                user32.DispatchMessageW(ctypes.byref(message))
        finally:
            removal = RAWINPUTDEVICE(
                HID_USAGE_PAGE_GENERIC, HID_USAGE_GENERIC_MOUSE, RIDEV_REMOVE, None
            )
            user32.RegisterRawInputDevices(ctypes.byref(removal), 1, ctypes.sizeof(RAWINPUTDEVICE))
            self._hwnd = None
            user32.UnregisterClassW(class_name, instance)
            del callback

    def _handle_input(self, user32: Any, lparam: int) -> None:
        size = wintypes.UINT(0)
        header_size = ctypes.sizeof(RAWINPUTHEADER)
        user32.GetRawInputData(lparam, RID_INPUT, None, ctypes.byref(size), header_size)
        if not size.value:
            return
        buffer = ctypes.create_string_buffer(size.value)
        read = user32.GetRawInputData(lparam, RID_INPUT, buffer, ctypes.byref(size), header_size)
        if read != size.value:
            return
        delta = parse_raw_mouse_delta(buffer.raw)
        if delta is not None:
            self._on_motion(*delta)


_WNDCLASS: Any = None


def _wndclass_type() -> Any:
    global _WNDCLASS
    if _WNDCLASS is None:
        wndproc_type = _load_api()[2]

        class WNDCLASSEXW(ctypes.Structure):
            _fields_ = [
                ("cbSize", wintypes.UINT),
                ("style", wintypes.UINT),
                ("lpfnWndProc", wndproc_type),
                ("cbClsExtra", ctypes.c_int),
                ("cbWndExtra", ctypes.c_int),
                ("hInstance", wintypes.HINSTANCE),
                ("hIcon", wintypes.HICON),
                ("hCursor", wintypes.HANDLE),
                ("hbrBackground", wintypes.HBRUSH),
                ("lpszMenuName", wintypes.LPCWSTR),
                ("lpszClassName", wintypes.LPCWSTR),
                ("hIconSm", wintypes.HICON),
            ]

        _WNDCLASS = WNDCLASSEXW
    return _WNDCLASS


_API: tuple[Any, Any, Any] | None = None


def _load_api() -> tuple[Any, Any, Any]:
    """Private, fully prototyped user32/kernel32 handles (64-bit safe handles and LPARAMs)."""
    global _API
    if _API is not None:
        return _API
    lresult = ctypes.c_ssize_t
    wndproc_type = ctypes.WINFUNCTYPE(
        lresult, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM
    )
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.GetModuleHandleW.argtypes = [wintypes.LPCWSTR]
    kernel32.GetModuleHandleW.restype = wintypes.HMODULE
    user32.RegisterClassExW.argtypes = [ctypes.c_void_p]
    user32.RegisterClassExW.restype = wintypes.ATOM
    user32.UnregisterClassW.argtypes = [wintypes.LPCWSTR, wintypes.HINSTANCE]
    user32.UnregisterClassW.restype = wintypes.BOOL
    user32.CreateWindowExW.argtypes = [
        wintypes.DWORD,
        wintypes.LPCWSTR,
        wintypes.LPCWSTR,
        wintypes.DWORD,
        ctypes.c_int,
        ctypes.c_int,
        ctypes.c_int,
        ctypes.c_int,
        wintypes.HWND,
        wintypes.HMENU,
        wintypes.HINSTANCE,
        wintypes.LPVOID,
    ]
    user32.CreateWindowExW.restype = wintypes.HWND
    user32.DestroyWindow.argtypes = [wintypes.HWND]
    user32.DestroyWindow.restype = wintypes.BOOL
    user32.DefWindowProcW.argtypes = [
        wintypes.HWND,
        wintypes.UINT,
        wintypes.WPARAM,
        wintypes.LPARAM,
    ]
    user32.DefWindowProcW.restype = lresult
    user32.PostMessageW.argtypes = [
        wintypes.HWND,
        wintypes.UINT,
        wintypes.WPARAM,
        wintypes.LPARAM,
    ]
    user32.PostMessageW.restype = wintypes.BOOL
    user32.PostQuitMessage.argtypes = [ctypes.c_int]
    user32.PostQuitMessage.restype = None
    user32.GetMessageW.argtypes = [
        ctypes.POINTER(wintypes.MSG),
        wintypes.HWND,
        wintypes.UINT,
        wintypes.UINT,
    ]
    user32.GetMessageW.restype = wintypes.BOOL
    user32.TranslateMessage.argtypes = [ctypes.POINTER(wintypes.MSG)]
    user32.TranslateMessage.restype = wintypes.BOOL
    user32.DispatchMessageW.argtypes = [ctypes.POINTER(wintypes.MSG)]
    user32.DispatchMessageW.restype = lresult
    user32.RegisterRawInputDevices.argtypes = [
        ctypes.POINTER(RAWINPUTDEVICE),
        wintypes.UINT,
        wintypes.UINT,
    ]
    user32.RegisterRawInputDevices.restype = wintypes.BOOL
    user32.GetRawInputData.argtypes = [
        wintypes.HANDLE,
        wintypes.UINT,
        wintypes.LPVOID,
        ctypes.POINTER(wintypes.UINT),
        wintypes.UINT,
    ]
    user32.GetRawInputData.restype = wintypes.UINT
    _API = (user32, kernel32, wndproc_type)
    return _API
