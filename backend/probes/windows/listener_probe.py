from __future__ import annotations

import json
import threading
import time
from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class CapturedEvent:
    kind: str
    monotonic_ns: int
    data: dict[str, Any]


def capture_until_f12(timeout_seconds: float = 30) -> list[CapturedEvent]:
    from pynput import keyboard, mouse

    events: list[CapturedEvent] = []
    stopped = threading.Event()

    def append(kind: str, **data: Any) -> None:
        events.append(CapturedEvent(kind, time.monotonic_ns(), data))

    def on_press(key: keyboard.Key | keyboard.KeyCode) -> bool | None:
        append("key_down", key=str(key))
        if key == keyboard.Key.f12:
            stopped.set()
            return False
        return None

    def on_release(key: keyboard.Key | keyboard.KeyCode) -> None:
        append("key_up", key=str(key))

    def on_move(x: int, y: int) -> None:
        append("mouse_move", x=x, y=y)

    def on_click(x: int, y: int, button: mouse.Button, pressed: bool) -> None:
        append("mouse_down" if pressed else "mouse_up", x=x, y=y, button=str(button))

    def on_scroll(x: int, y: int, dx: int, dy: int) -> None:
        append("wheel", x=x, y=y, dx=dx, dy=dy)

    keyboard_listener = keyboard.Listener(on_press=on_press, on_release=on_release)
    mouse_listener = mouse.Listener(on_move=on_move, on_click=on_click, on_scroll=on_scroll)
    keyboard_listener.start()
    mouse_listener.start()
    stopped.wait(timeout_seconds)
    keyboard_listener.stop()
    mouse_listener.stop()
    keyboard_listener.join(1)
    mouse_listener.join(1)
    if keyboard_listener.is_alive() or mouse_listener.is_alive():
        raise RuntimeError("listener thread did not stop")
    return events


def main() -> None:
    events = capture_until_f12()
    print(json.dumps([asdict(event) for event in events], ensure_ascii=True))


if __name__ == "__main__":
    main()