from __future__ import annotations

import math
from dataclasses import dataclass, field
from uuid import uuid4

from pydantic import TypeAdapter

from keymouse_studio.api.schemas.actions import ScriptAction
from keymouse_studio.api.schemas.recording import RecordingConfig
from keymouse_studio.domain.enums import MouseButton
from keymouse_studio.infrastructure.input.listener import RawInputEvent

_SCRIPT_ACTION: TypeAdapter[ScriptAction] = TypeAdapter(ScriptAction)
_MODIFIERS = {
    "alt",
    "alt_l",
    "alt_r",
    "ctrl",
    "ctrl_l",
    "ctrl_r",
    "shift",
    "shift_l",
    "shift_r",
    "cmd",
    "cmd_l",
    "cmd_r",
    "win",
}
_ALT = {"alt", "alt_l", "alt_r"}
_CTRL = {"ctrl", "ctrl_l", "ctrl_r"}
_WIN = {"cmd", "cmd_l", "cmd_r", "win"}
_MODIFIER_NAMES = {
    "alt": "alt",
    "alt_l": "alt",
    "alt_r": "alt",
    "ctrl": "ctrl",
    "ctrl_l": "ctrl",
    "ctrl_r": "ctrl",
    "shift": "shift",
    "shift_l": "shift",
    "shift_r": "shift",
    "cmd": "win",
    "cmd_l": "win",
    "cmd_r": "win",
    "win": "win",
}
_MODIFIER_ORDER = ("ctrl", "alt", "shift", "win")


def _hotkey_parts(value: str) -> frozenset[str]:
    aliases = {
        "control": "ctrl",
        "meta": "win",
        "cmd": "win",
        "escape": "esc",
        "arrowup": "up",
        "arrowdown": "down",
        "arrowleft": "left",
        "arrowright": "right",
        "pageup": "page_up",
        "pagedown": "page_down",
    }
    return frozenset(
        aliases.get(part.strip().lower().replace("-", "_"), part.strip().lower())
        for part in value.split("+")
        if part.strip()
    )


@dataclass(frozen=True, slots=True)
class TimedMove:
    monotonic_ns: int
    x: int
    y: int


def compress_moves(moves: list[TimedMove], min_sample_ms: int, error_px: float) -> list[TimedMove]:
    if len(moves) <= 2:
        return moves.copy()
    sample_ns = min_sample_ms * 1_000_000
    sampled = [moves[0]]
    for move in moves[1:-1]:
        if move.monotonic_ns - sampled[-1].monotonic_ns >= sample_ns:
            sampled.append(move)
    if sampled[-1] != moves[-1]:
        sampled.append(moves[-1])
    return _rdp(sampled, error_px)


def _rdp(points: list[TimedMove], epsilon: float) -> list[TimedMove]:
    if len(points) <= 2:
        return points.copy()
    retained = {0, len(points) - 1}
    segments = [(0, len(points) - 1)]
    while segments:
        start_index, end_index = segments.pop()
        start = points[start_index]
        end = points[end_index]
        max_distance = -1.0
        split_index = start_index
        for index in range(start_index + 1, end_index):
            distance = _line_distance(points[index], start, end)
            if distance > max_distance:
                max_distance = distance
                split_index = index
        if max_distance > epsilon:
            retained.add(split_index)
            segments.append((start_index, split_index))
            segments.append((split_index, end_index))
    return [points[index] for index in sorted(retained)]


def _line_distance(point: TimedMove, start: TimedMove, end: TimedMove) -> float:
    dx = end.x - start.x
    dy = end.y - start.y
    if dx == 0 and dy == 0:
        return math.hypot(point.x - start.x, point.y - start.y)
    numerator = abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x)
    return numerator / math.hypot(dx, dy)


@dataclass(slots=True)
class ActionNormalizer:
    config: RecordingConfig
    actions: list[ScriptAction] = field(default_factory=list)
    _last_action_ns: int | None = None
    _moves: list[TimedMove] = field(default_factory=list)
    _physical_keys: dict[str, RawInputEvent] = field(default_factory=dict)
    _recorded_keys: dict[str, RawInputEvent] = field(default_factory=dict)
    _suppressed_keys: set[str] = field(default_factory=set)
    _pending_modifiers: dict[str, RawInputEvent] = field(default_factory=dict)
    _physical_buttons: set[MouseButton] = field(default_factory=set)
    _recorded_buttons: set[MouseButton] = field(default_factory=set)
    _control_hotkeys: set[frozenset[str]] = field(init=False, default_factory=set)

    def __post_init__(self) -> None:
        self._control_hotkeys = {
            parts
            for value in self.config.control_hotkeys
            if (parts := _hotkey_parts(value))
        }

    def process(self, event: RawInputEvent) -> list[ScriptAction]:
        if event.type == "mouse_move":
            if self.config.record_mouse and self.config.record_mouse_move:
                if event.x is not None and event.y is not None:
                    self._moves.append(TimedMove(event.monotonic_ns, event.x, event.y))
            return []
        captured = self._flush_moves()
        if event.type.startswith("key_"):
            captured.extend(self._process_key(event))
            return captured
        if event.type in {"mouse_button_down", "mouse_button_up"}:
            captured.extend(self._process_button(event))
            return captured
        if event.type == "mouse_wheel":
            if self.config.record_mouse and self.config.record_wheel:
                captured.append(
                    self._append(
                        event.type,
                        {"deltaX": event.delta_x, "deltaY": event.delta_y},
                        event.monotonic_ns,
                    )
                )
            return captured
        return captured

    def observe_paused(self, event: RawInputEvent) -> None:
        if event.type == "key_down" and event.key_code is not None:
            key = event.key_code.lower()
            self._suppressed_keys.discard(key)
            self._physical_keys[key] = event
        elif event.type == "key_up" and event.key_code is not None:
            key = event.key_code.lower()
            self._physical_keys.pop(key, None)
            self._suppressed_keys.discard(key)
            self._pending_modifiers.pop(key, None)
        elif event.type == "mouse_button_down" and event.button is not None:
            self._physical_buttons.add(event.button)
        elif event.type == "mouse_button_up" and event.button is not None:
            self._physical_buttons.discard(event.button)

    def pause(self, monotonic_ns: int) -> list[ScriptAction]:
        captured = self._flush_moves()
        self._pending_modifiers.clear()
        self._suppressed_keys.intersection_update(self._physical_keys)
        for key, down_event in sorted(
            self._recorded_keys.items(),
            key=lambda item: item[0] in _MODIFIERS,
        ):
            captured.append(
                self._key_action(
                    RawInputEvent(
                        "key_up",
                        monotonic_ns,
                        key_code=down_event.key_code,
                        scan_code=down_event.scan_code,
                        extended=down_event.extended,
                    )
                )
            )
            self._recorded_keys.pop(key, None)
        for button in tuple(self._recorded_buttons):
            captured.append(self._append("mouse_button_up", {"button": button}, monotonic_ns))
            self._recorded_buttons.discard(button)
        return captured

    def resume(self, monotonic_ns: int) -> list[ScriptAction]:
        captured: list[ScriptAction] = []
        self._suppressed_keys.intersection_update(self._physical_keys)
        self._pending_modifiers.clear()
        keys = set(self._physical_keys)
        active_hotkey = frozenset(
            _MODIFIER_NAMES.get(key, key) for key in keys
        )
        reserved = bool(keys & _WIN or (keys & _ALT and "tab" in keys))
        reserved = reserved or bool(keys & _ALT and keys & _CTRL and "delete" in keys)
        reserved = reserved or active_hotkey in self._control_hotkeys
        if not reserved:
            for key, event in sorted(
                self._physical_keys.items(),
                key=lambda item: item[1].monotonic_ns,
            ):
                down = RawInputEvent(
                    "key_down",
                    monotonic_ns,
                    key_code=event.key_code,
                    scan_code=event.scan_code,
                    extended=event.extended,
                )
                captured.append(self._key_action(down))
                self._recorded_keys[key] = down
        for button in sorted(self._physical_buttons):
            captured.append(self._append("mouse_button_down", {"button": button}, monotonic_ns))
            self._recorded_buttons.add(button)
        return captured

    def finish(self, monotonic_ns: int) -> list[ScriptAction]:
        return self.pause(monotonic_ns)

    def shift_timeline(self, duration_ns: int) -> None:
        shift = max(0, duration_ns)
        if self._last_action_ns is not None:
            self._last_action_ns += shift
        self._moves = [TimedMove(move.monotonic_ns + shift, move.x, move.y) for move in self._moves]

    def _current_hotkey(self, key: str) -> frozenset[str]:
        parts = {
            _MODIFIER_NAMES.get(pressed, pressed)
            for pressed in self._physical_keys
            if pressed in _MODIFIERS
        }
        parts.add(_MODIFIER_NAMES.get(key, key))
        return frozenset(parts)

    def _is_control_hotkey(self, key: str) -> bool:
        return self._current_hotkey(key) in self._control_hotkeys

    def _process_key(self, event: RawInputEvent) -> list[ScriptAction]:
        if not self.config.record_keyboard or event.key_code is None:
            return []
        key = event.key_code.lower()
        if event.type == "key_down":
            if key in self._physical_keys:
                return []
            self._physical_keys[key] = event
            if key in _WIN:
                self._suppressed_keys.add(key)
                return []
            if key in _MODIFIERS:
                self._pending_modifiers[key] = event
                return []
            if self._is_control_hotkey(key):
                self._suppressed_keys.update(self._physical_keys)
                self._pending_modifiers.clear()
                return []
            if self._is_reserved(key):
                self._suppressed_keys.update(self._physical_keys)
                self._pending_modifiers.clear()
                return []
            captured = self._flush_pending_modifiers()
            captured.append(self._key_action(event))
            self._recorded_keys[key] = event
            return captured
        self._physical_keys.pop(key, None)
        if key in self._suppressed_keys:
            self._suppressed_keys.discard(key)
            return []
        pending = self._pending_modifiers.pop(key, None)
        if pending is not None:
            return [self._key_action(pending), self._key_action(event)]
        if key not in self._recorded_keys:
            return []
        self._recorded_keys.pop(key, None)
        return [self._key_action(event)]

    def _process_button(self, event: RawInputEvent) -> list[ScriptAction]:
        if event.button is None:
            return []
        button = event.button
        if event.type == "mouse_button_down":
            if button in self._physical_buttons:
                return []
            self._physical_buttons.add(button)
            if not self.config.record_mouse:
                return []
            self._recorded_buttons.add(button)
        else:
            self._physical_buttons.discard(button)
            if button not in self._recorded_buttons:
                return []
            self._recorded_buttons.discard(button)
        return [self._append(event.type, {"button": button}, event.monotonic_ns)]

    def _is_reserved(self, key: str) -> bool:
        pressed = set(self._physical_keys)
        return bool(
            key in _WIN
            or pressed & _WIN
            or (key == "tab" and pressed & _ALT)
            or (key == "delete" and pressed & _ALT and pressed & _CTRL)
        )

    def _flush_pending_modifiers(self) -> list[ScriptAction]:
        pending = sorted(
            self._pending_modifiers.items(),
            key=lambda item: item[1].monotonic_ns,
        )
        self._pending_modifiers.clear()
        captured = []
        for key, event in pending:
            captured.append(self._key_action(event))
            self._recorded_keys[key] = event
        return captured

    def _key_action(self, event: RawInputEvent) -> ScriptAction:
        return self._append(
            event.type,
            {
                "keyCode": event.key_code,
                "scanCode": event.scan_code,
                "extended": event.extended,
            },
            event.monotonic_ns,
        )

    def _flush_moves(self) -> list[ScriptAction]:
        moves = compress_moves(
            self._moves,
            self.config.min_move_sample_ms,
            self.config.move_error_px,
        )
        self._moves = []
        return [
            self._append(
                "mouse_move",
                {"x": move.x, "y": move.y, "durationMs": 0},
                move.monotonic_ns,
            )
            for move in moves
        ]

    def _append(
        self,
        event_type: str,
        payload: dict[str, object],
        monotonic_ns: int,
    ) -> ScriptAction:
        delay = 0
        if self._last_action_ns is not None:
            delay = max(0, (monotonic_ns - self._last_action_ns) // 1_000_000)
        self._last_action_ns = monotonic_ns
        action = _SCRIPT_ACTION.validate_python(
            {
                "id": uuid4(),
                "type": event_type,
                "enabled": True,
                "delayBeforeMs": delay,
                "payload": payload,
            }
        )
        self.actions.append(action)
        return action
