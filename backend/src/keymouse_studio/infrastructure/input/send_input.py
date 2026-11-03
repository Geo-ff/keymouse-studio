import ctypes
import sys
from ctypes import wintypes
from functools import cache
from typing import Any, ClassVar

from keymouse_studio.domain.enums import MouseButton
from keymouse_studio.infrastructure.input.adapter import ReleaseResult
from keymouse_studio.infrastructure.input.key_codes import resolve_virtual_key

INPUT_MOUSE = 0
INPUT_KEYBOARD = 1
KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_SCANCODE = 0x0008
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_WHEEL = 0x0800
MOUSEEVENTF_HWHEEL = 0x01000
MOUSEEVENTF_VIRTUALDESK = 0x4000
MOUSEEVENTF_ABSOLUTE = 0x8000
SM_XVIRTUALSCREEN = 76
SM_YVIRTUALSCREEN = 77
SM_CXVIRTUALSCREEN = 78
SM_CYVIRTUALSCREEN = 79
WHEEL_DELTA = 120
MAPVK_VK_TO_VSC_EX = 4
# Navigation / right-hand modifier keys whose scan code needs the E0 (extended) prefix.
# MapVirtualKey(..., MAPVK_VK_TO_VSC_EX) usually reports this itself; the table is a fallback
# so that e.g. VK_LEFT can never be sent as the bare scan code of Numpad 4.
_EXTENDED_VIRTUAL_KEYS = frozenset(
    {
        0x21,  # PAGE UP
        0x22,  # PAGE DOWN
        0x23,  # END
        0x24,  # HOME
        0x25,  # LEFT
        0x26,  # UP
        0x27,  # RIGHT
        0x28,  # DOWN
        0x2D,  # INSERT
        0x2E,  # DELETE
        0x5B,  # LEFT WIN
        0x5C,  # RIGHT WIN
        0x5D,  # APPS
        0x6F,  # NUMPAD DIVIDE
        0xA3,  # RIGHT CTRL
        0xA5,  # RIGHT ALT
    }
)


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong)),
    ]


class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", wintypes.WORD),
        ("wScan", wintypes.WORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong)),
    ]


class HARDWAREINPUT(ctypes.Structure):
    _fields_ = [
        ("uMsg", wintypes.DWORD),
        ("wParamL", wintypes.WORD),
        ("wParamH", wintypes.WORD),
    ]


class INPUTUNION(ctypes.Union):
    _fields_: ClassVar[list[tuple[str, type[ctypes.Structure]]]] = [
        ("mi", MOUSEINPUT),
        ("ki", KEYBDINPUT),
        ("hi", HARDWAREINPUT),
    ]


class INPUT(ctypes.Structure):
    _anonymous_ = ("union",)
    _fields_ = [("type", wintypes.DWORD), ("union", INPUTUNION)]


class SendInputAdapter:
    def __init__(self) -> None:
        self._pressed: set[MouseButton] = set()
        self._pressed_keys: set[tuple[str, int | None, bool]] = set()

    def get_position(self) -> tuple[int, int]:
        point = wintypes.POINT()
        if not ctypes.windll.user32.GetCursorPos(ctypes.byref(point)):
            raise ctypes.WinError()
        return int(point.x), int(point.y)

    def move(self, x: int, y: int) -> None:
        user32 = ctypes.windll.user32
        left = user32.GetSystemMetrics(SM_XVIRTUALSCREEN)
        top = user32.GetSystemMetrics(SM_YVIRTUALSCREEN)
        width = user32.GetSystemMetrics(SM_CXVIRTUALSCREEN)
        height = user32.GetSystemMetrics(SM_CYVIRTUALSCREEN)
        inside = left <= x < left + width and top <= y < top + height
        if width <= 1 or height <= 1 or not inside:
            raise ValueError("Position is outside the current virtual desktop")
        dx = round((x - left) * 65535 / (width - 1))
        dy = round((y - top) * 65535 / (height - 1))
        flags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK
        self._send_mouse(flags, dx, dy)

    def button_down(self, button: MouseButton) -> None:
        self._send_mouse(_button_flags(button)[0])
        self._pressed.add(button)

    def button_up(self, button: MouseButton) -> None:
        self._send_mouse(_button_flags(button)[1])
        self._pressed.discard(button)

    def wheel(self, delta_x: int, delta_y: int) -> None:
        if delta_y:
            self._send_mouse(MOUSEEVENTF_WHEEL, data=delta_y * WHEEL_DELTA)
        if delta_x:
            self._send_mouse(MOUSEEVENTF_HWHEEL, data=delta_x * WHEEL_DELTA)

    def key_down(self, key_code: str, scan_code: int | None, extended: bool) -> None:
        self._send_key(key_code, scan_code, extended, False)
        self._pressed_keys.add((key_code, scan_code, extended))

    def key_up(self, key_code: str, scan_code: int | None, extended: bool) -> None:
        self._send_key(key_code, scan_code, extended, True)
        self._pressed_keys.discard((key_code, scan_code, extended))

    def release_all(self) -> ReleaseResult:
        failures: list[str] = []
        released_count = 0
        for button in tuple(self._pressed):
            try:
                self.button_up(button)
                released_count += 1
            except OSError as exc:
                failures.append(f"mouse:{button}:{exc}")
                self._pressed.discard(button)
        for key_code, scan_code, extended in tuple(self._pressed_keys):
            try:
                self.key_up(key_code, scan_code, extended)
                released_count += 1
            except (OSError, ValueError) as exc:
                failures.append(f"key:{key_code}:{exc}")
                self._pressed_keys.discard((key_code, scan_code, extended))
        return ReleaseResult(released_count, tuple(failures))

    def _send_mouse(self, flags: int, dx: int = 0, dy: int = 0, data: int = 0) -> None:
        value = INPUT(
            type=INPUT_MOUSE,
            mi=MOUSEINPUT(dx=dx, dy=dy, mouseData=ctypes.c_ulong(data).value, dwFlags=flags),
        )
        self._send(value)

    def _send_key(
        self, key_code: str, scan_code: int | None, extended: bool, released: bool
    ) -> None:
        flags = KEYEVENTF_KEYUP if released else 0
        if scan_code is not None:
            virtual_key = 0
            scan = scan_code
            if scan > 0xFF:
                # Accept "E0 xx" style codes (e.g. 0xE04B) as extended + low byte.
                extended = extended or (scan >> 8) == 0xE0
                scan &= 0xFF
            flags |= KEYEVENTF_SCANCODE
        else:
            virtual_key = resolve_virtual_key(key_code)
            scan, mapped_extended = _scan_code_for_virtual_key(virtual_key)
            if scan:
                # Games that read DirectInput / Raw Input identify keys by scan code only;
                # a VK-only event arrives with scan code 0 and is ignored. Send the key as a
                # hardware scan code (Windows derives the VK for normal apps from it).
                virtual_key = 0
                flags |= KEYEVENTF_SCANCODE
                extended = extended or mapped_extended
        if extended:
            flags |= KEYEVENTF_EXTENDEDKEY
        self._send(
            INPUT(
                type=INPUT_KEYBOARD,
                ki=KEYBDINPUT(wVk=virtual_key, wScan=scan, dwFlags=flags),
            )
        )

    def _send(self, value: INPUT) -> None:
        sent = ctypes.windll.user32.SendInput(1, ctypes.byref(value), ctypes.sizeof(INPUT))
        if sent != 1:
            raise ctypes.WinError()


@cache
def _user32() -> Any:
    """Private user32 handle so argtypes set here never leak into other ctypes users."""
    library = ctypes.WinDLL("user32")
    library.GetForegroundWindow.argtypes = []
    library.GetForegroundWindow.restype = wintypes.HWND
    library.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.c_void_p]
    library.GetWindowThreadProcessId.restype = wintypes.DWORD
    library.GetKeyboardLayout.argtypes = [wintypes.DWORD]
    library.GetKeyboardLayout.restype = ctypes.c_void_p
    library.MapVirtualKeyExW.argtypes = [wintypes.UINT, wintypes.UINT, ctypes.c_void_p]
    library.MapVirtualKeyExW.restype = wintypes.UINT
    return library


def _foreground_keyboard_layout(user32: Any) -> int | None:
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return None
    thread_id = user32.GetWindowThreadProcessId(hwnd, None)
    if not thread_id:
        return None
    layout = user32.GetKeyboardLayout(thread_id)
    return int(layout) if layout else None


def _scan_code_for_virtual_key(virtual_key: int) -> tuple[int, bool]:
    """Map a virtual key to (scan code, extended) using the foreground window's layout.

    Returns ``(0, False)`` when no usable hardware scan code exists; callers then fall back to
    a VK-only event.
    """
    if sys.platform != "win32":
        return 0, False
    try:
        user32 = _user32()
        mapped = int(
            user32.MapVirtualKeyExW(
                virtual_key, MAPVK_VK_TO_VSC_EX, _foreground_keyboard_layout(user32)
            )
        )
    except (AttributeError, OSError):
        return 0, False
    return _split_mapped_scan_code(virtual_key, mapped)


def _split_mapped_scan_code(virtual_key: int, mapped: int) -> tuple[int, bool]:
    scan = mapped & 0xFF
    prefix = (mapped >> 8) & 0xFF
    if not scan or prefix == 0xE1:
        # No scan code, or an E1 sequence (Pause) that cannot be expressed as one INPUT.
        return 0, False
    return scan, prefix == 0xE0 or virtual_key in _EXTENDED_VIRTUAL_KEYS


def _button_flags(button: MouseButton) -> tuple[int, int]:
    return {
        MouseButton.LEFT: (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
        MouseButton.RIGHT: (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
        MouseButton.MIDDLE: (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
    }[button]
