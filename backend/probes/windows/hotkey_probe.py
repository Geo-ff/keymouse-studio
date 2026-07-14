from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field


@dataclass(slots=True)
class InputRegistry:
    keys: set[int] = field(default_factory=set)
    buttons: set[str] = field(default_factory=set)

    def press_key(self, virtual_key: int) -> None:
        self.keys.add(virtual_key)

    def release_key(self, virtual_key: int) -> None:
        self.keys.discard(virtual_key)

    def press_button(self, button: str) -> None:
        self.buttons.add(button)

    def release_button(self, button: str) -> None:
        self.buttons.discard(button)

    def release_all(
        self,
        key_release: Callable[[int], None],
        button_release: Callable[[str], None],
    ) -> list[str]:
        failures: list[str] = []
        for virtual_key in tuple(self.keys):
            try:
                key_release(virtual_key)
            except OSError:
                failures.append(f"key:{virtual_key}")
            finally:
                self.keys.discard(virtual_key)
        for button in tuple(self.buttons):
            try:
                button_release(button)
            except OSError:
                failures.append(f"button:{button}")
            finally:
                self.buttons.discard(button)
        return failures


def latency_ms(pressed_ns: int, handled_ns: int) -> float:
    if handled_ns < pressed_ns:
        raise ValueError("handled timestamp precedes pressed timestamp")
    return (handled_ns - pressed_ns) / 1_000_000