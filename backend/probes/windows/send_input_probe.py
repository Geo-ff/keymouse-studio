from __future__ import annotations

import ctypes
from ctypes import wintypes
from dataclasses import dataclass
from enum import StrEnum
from typing import ClassVar

from probes.windows.display_probe import VirtualBounds, normalize_absolute_coordinate
from probes.windows.hotkey_probe import InputRegistry

INPUT_MOUSE = 0
INPUT_KEYBOARD = 1
KEYEVENTF_KEYUP = 0x0002
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_WHEEL = 0x0800
MOUSEEVENTF_VIRTUALDESK = 0x4000
MOUSEEVENTF_ABSOLUTE = 0x8000


class MouseButton(StrEnum):
    LEFT = "left"
    RIGHT = "right"
    MIDDLE = "middle"


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


@dataclass(slots=True)
class SendInputProbe:
    registry: InputRegistry

    def _send(self, value: INPUT) -> None:
        sent = ctypes.windll.user32.SendInput(1, ctypes.byref(value), ctypes.sizeof(INPUT))
        if sent != 1:
            raise ctypes.WinError()

    def key_down(self, virtual_key: int) -> None:
        self._send(INPUT(type=INPUT_KEYBOARD, ki=KEYBDINPUT(wVk=virtual_key)))
        self.registry.press_key(virtual_key)

    def key_up(self, virtual_key: int) -> None:
        self._send(
            INPUT(
                type=INPUT_KEYBOARD,
                ki=KEYBDINPUT(wVk=virtual_key, dwFlags=KEYEVENTF_KEYUP),
            )
        )
        self.registry.release_key(virtual_key)

    def move(self, x: int, y: int, bounds: VirtualBounds) -> None:
        dx, dy = normalize_absolute_coordinate(x, y, bounds)
        flags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK
        self._send(INPUT(type=INPUT_MOUSE, mi=MOUSEINPUT(dx=dx, dy=dy, dwFlags=flags)))

    def button_down(self, button: MouseButton) -> None:
        self._send_mouse_flag(_button_flags(button)[0])
        self.registry.press_button(button.value)

    def button_up(self, button: MouseButton) -> None:
        self._send_mouse_flag(_button_flags(button)[1])
        self.registry.release_button(button.value)

    def wheel(self, delta: int) -> None:
        self._send(
            INPUT(
                type=INPUT_MOUSE,
                mi=MOUSEINPUT(mouseData=ctypes.c_ulong(delta).value, dwFlags=MOUSEEVENTF_WHEEL),
            )
        )

    def release_all(self) -> list[str]:
        return self.registry.release_all(
            self.key_up,
            lambda value: self.button_up(MouseButton(value)),
        )

    def _send_mouse_flag(self, flag: int) -> None:
        self._send(INPUT(type=INPUT_MOUSE, mi=MOUSEINPUT(dwFlags=flag)))


def _button_flags(button: MouseButton) -> tuple[int, int]:
    return {
        MouseButton.LEFT: (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
        MouseButton.RIGHT: (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
        MouseButton.MIDDLE: (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
    }[button]