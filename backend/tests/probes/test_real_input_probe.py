from __future__ import annotations

import ctypes
import threading
import time
from ctypes import wintypes

import pytest

from probes.windows.hotkey_probe import InputRegistry, latency_ms
from probes.windows.send_input_probe import MouseButton, SendInputProbe
from probes.windows.system_probe import snapshot

pytestmark = [pytest.mark.windows_probe, pytest.mark.real_input, pytest.mark.manual]


def test_sendinput_f12_reaches_global_listener_within_target() -> None:
    from pynput import keyboard

    received = threading.Event()
    pressed_ns = 0
    handled_ns = 0

    def on_press(key: keyboard.Key | keyboard.KeyCode) -> bool | None:
        nonlocal handled_ns
        if key == keyboard.Key.f12:
            handled_ns = time.monotonic_ns()
            received.set()
            return False
        return None

    listener = keyboard.Listener(on_press=on_press)
    listener.start()
    try:
        time.sleep(0.1)
        probe = SendInputProbe(InputRegistry())
        pressed_ns = time.monotonic_ns()
        probe.key_down(0x7B)
        probe.key_up(0x7B)
        assert received.wait(1)
        listener.join(1)
        assert not listener.is_alive()
        assert latency_ms(pressed_ns, handled_ns) <= 50
        assert not probe.registry.keys
    finally:
        listener.stop()
        listener.join(1)


def test_sendinput_mouse_click_and_wheel_reach_global_listener() -> None:
    from pynput import mouse

    layout = snapshot()
    primary = next(display for display in layout.displays if display.primary)
    target_x = primary.left + primary.width // 2
    target_y = primary.top + primary.height // 2
    original = wintypes.POINT()
    assert ctypes.windll.user32.GetCursorPos(ctypes.byref(original))
    click_received = threading.Event()
    wheel_received = threading.Event()

    def on_click(x: int, y: int, button: mouse.Button, pressed: bool) -> None:
        if button == mouse.Button.left and not pressed and (x, y) == (target_x, target_y):
            click_received.set()

    def on_scroll(x: int, y: int, dx: int, dy: int) -> None:
        if (x, y) == (target_x, target_y) and dy:
            wheel_received.set()

    listener = mouse.Listener(on_click=on_click, on_scroll=on_scroll)
    listener.start()
    probe = SendInputProbe(InputRegistry())
    try:
        time.sleep(0.1)
        probe.move(target_x, target_y, layout.bounds)
        probe.button_down(MouseButton.LEFT)
        probe.button_up(MouseButton.LEFT)
        probe.wheel(120)
        assert click_received.wait(1)
        assert wheel_received.wait(1)
        assert not probe.registry.buttons
    finally:
        probe.release_all()
        ctypes.windll.user32.SetCursorPos(original.x, original.y)
        listener.stop()
        listener.join(1)
