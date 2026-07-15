import ctypes
from ctypes import wintypes
from typing import ClassVar

from keymouse_studio.domain.enums import MouseButton
from keymouse_studio.infrastructure.input.adapter import ReleaseResult

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
            flags |= KEYEVENTF_SCANCODE
        else:
            virtual_key = _virtual_key(key_code)
            scan = 0
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


def _button_flags(button: MouseButton) -> tuple[int, int]:
    return {
        MouseButton.LEFT: (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
        MouseButton.RIGHT: (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
        MouseButton.MIDDLE: (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
    }[button]


def _virtual_key(key_code: str) -> int:
    normalized = key_code.lower()
    named = {
        "alt": 0x12,
        "alt_l": 0xA4,
        "alt_r": 0xA5,
        "backspace": 0x08,
        "caps_lock": 0x14,
        "ctrl": 0x11,
        "ctrl_l": 0xA2,
        "ctrl_r": 0xA3,
        "delete": 0x2E,
        "down": 0x28,
        "end": 0x23,
        "enter": 0x0D,
        "esc": 0x1B,
        "home": 0x24,
        "insert": 0x2D,
        "left": 0x25,
        "page_down": 0x22,
        "page_up": 0x21,
        "right": 0x27,
        "shift": 0x10,
        "shift_l": 0xA0,
        "shift_r": 0xA1,
        "space": 0x20,
        "tab": 0x09,
        "up": 0x26,
    }
    named.update({f"f{number}": 0x6F + number for number in range(1, 25)})
    if normalized in named:
        return named[normalized]
    if normalized.startswith("vk_"):
        return int(normalized[3:])
    if len(key_code) == 1:
        result = int(ctypes.windll.user32.VkKeyScanW(key_code))
        if result != -1:
            return result & 0xFF
    raise ValueError(f"Unsupported key code: {key_code}")
