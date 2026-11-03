from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from keymouse_studio.api.schemas.common import ApiModel
from keymouse_studio.domain.enums import LoopMode

_MODIFIER_ORDER = ("ctrl", "alt", "shift", "win")
_MODIFIER_ALIASES = {
    "control": "ctrl",
    "ctrl_l": "ctrl",
    "ctrl_r": "ctrl",
    "alt_l": "alt",
    "alt_r": "alt",
    "shift_l": "shift",
    "shift_r": "shift",
    "cmd": "win",
    "cmd_l": "win",
    "cmd_r": "win",
    "meta": "win",
    "os": "win",
}
_MODIFIERS = set(_MODIFIER_ORDER)
# Browser / UI display names → canonical storage keys
_KEY_ALIASES = {
    "escape": "esc",
    "arrowup": "up",
    "arrowdown": "down",
    "arrowleft": "left",
    "arrowright": "right",
    "pageup": "page_up",
    "pagedown": "page_down",
    "page_up": "page_up",
    "page_down": "page_down",
    " ": "space",
    "spacebar": "space",
    "return": "enter",
}
_NAMED_KEYS = {
    "backspace",
    "delete",
    "down",
    "end",
    "enter",
    "esc",
    "home",
    "insert",
    "left",
    "page_down",
    "page_up",
    "right",
    "space",
    "tab",
    "up",
}
_NAMED_KEYS.update(f"f{number}" for number in range(1, 25))


def _normalize_part(part: str) -> str:
    raw = part.strip().lower().replace("-", "_")
    if raw in _MODIFIER_ALIASES:
        return _MODIFIER_ALIASES[raw]
    if raw in _MODIFIERS:
        return raw
    # pageup / pagedown without underscore (from KeyboardEvent.key)
    compact = raw.replace("_", "")
    if compact in _KEY_ALIASES:
        return _KEY_ALIASES[compact]
    if raw in _KEY_ALIASES:
        return _KEY_ALIASES[raw]
    return raw


def normalize_hotkey(value: str) -> str:
    parts = [_normalize_part(part) for part in value.replace(" ", "").split("+") if part.strip()]
    # Also accept spaced chords like "Ctrl + Shift + F11"
    if not parts:
        parts = [_normalize_part(part) for part in value.split("+")]
    if not parts or any(not part for part in parts) or len(set(parts)) != len(parts):
        raise ValueError("快捷键格式无效")
    keys = [part for part in parts if part not in _MODIFIERS]
    if len(keys) != 1:
        raise ValueError("快捷键必须包含且仅包含一个主键(可加修饰键)")
    key = keys[0]
    if not (len(key) == 1 and key.isalnum()) and key not in _NAMED_KEYS:
        raise ValueError("不支持的快捷键")
    modifiers = [modifier for modifier in _MODIFIER_ORDER if modifier in parts]
    return "+".join([*modifiers, key])


def normalize_optional_hotkey(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        return ""
    return normalize_hotkey(trimmed)


MAX_SCRIPT_HOTKEYS = 100
OPTIONAL_HOTKEY_FIELDS = (
    "record_start_hotkey",
    "record_stop_hotkey",
    "playback_start_hotkey",
    "playback_stop_hotkey",
    "clicker_toggle_hotkey",
)
ScriptHotkeys = Annotated[dict[UUID, str], Field(max_length=MAX_SCRIPT_HOTKEYS)]


def normalize_script_hotkeys(value: dict[UUID, str]) -> dict[UUID, str]:
    """Normalize per-script hotkeys; an empty hotkey removes the binding."""
    normalized: dict[UUID, str] = {}
    for script_id, hotkey in value.items():
        chord = normalize_optional_hotkey(hotkey)
        if chord:
            normalized[script_id] = chord
    return normalized


def ensure_unique_hotkeys(fixed: list[str], script_hotkeys: dict[UUID, str]) -> None:
    values = [item for item in fixed if item] + list(script_hotkeys.values())
    if len(values) != len(set(values)):
        raise ValueError("快捷键不能重复配置")


class ApplicationSettings(ApiModel):
    default_speed_multiplier: Annotated[float, Field(gt=0, le=100)] = 1.0
    default_loop_mode: LoopMode = LoopMode.COUNT
    default_loop_count: Annotated[int, Field(ge=1, le=1_000_000)] = 1
    default_countdown_ms: Annotated[int, Field(ge=0, le=86_400_000)] = 3000
    emergency_stop_hotkey: str = "f12"
    record_start_hotkey: str = ""
    record_stop_hotkey: str = ""
    playback_start_hotkey: str = ""
    playback_stop_hotkey: str = ""
    clicker_toggle_hotkey: str = ""
    script_hotkeys: ScriptHotkeys = Field(default_factory=dict)

    @field_validator("emergency_stop_hotkey")
    @classmethod
    def validate_emergency_stop_hotkey(cls, value: str) -> str:
        return normalize_hotkey(value)

    @field_validator(*OPTIONAL_HOTKEY_FIELDS)
    @classmethod
    def validate_optional_hotkey(cls, value: str) -> str:
        return normalize_optional_hotkey(value)

    @field_validator("script_hotkeys")
    @classmethod
    def validate_script_hotkeys(cls, value: dict[UUID, str]) -> dict[UUID, str]:
        return normalize_script_hotkeys(value)

    @model_validator(mode="after")
    def validate_unique_hotkeys(self) -> "ApplicationSettings":
        ensure_unique_hotkeys(self.control_hotkeys(), self.script_hotkeys)
        return self

    def control_hotkeys(self) -> list[str]:
        """Fixed (non per-script) global hotkeys, in a stable order; empty means unset."""
        return [
            self.emergency_stop_hotkey,
            self.record_start_hotkey,
            self.record_stop_hotkey,
            self.playback_start_hotkey,
            self.playback_stop_hotkey,
            self.clicker_toggle_hotkey,
        ]


class ApplicationSettingsUpdate(ApiModel):
    default_speed_multiplier: Annotated[float, Field(gt=0, le=100)]
    default_loop_mode: LoopMode
    default_loop_count: Annotated[int, Field(ge=1, le=1_000_000)]
    default_countdown_ms: Annotated[int, Field(ge=0, le=86_400_000)]
    emergency_stop_hotkey: str
    record_start_hotkey: str = ""
    record_stop_hotkey: str = ""
    playback_start_hotkey: str = ""
    playback_stop_hotkey: str = ""
    clicker_toggle_hotkey: str = ""
    script_hotkeys: ScriptHotkeys = Field(default_factory=dict)

    @field_validator("emergency_stop_hotkey")
    @classmethod
    def validate_emergency_stop_hotkey(cls, value: str) -> str:
        return normalize_hotkey(value)

    @field_validator(*OPTIONAL_HOTKEY_FIELDS)
    @classmethod
    def validate_optional_hotkey(cls, value: str) -> str:
        return normalize_optional_hotkey(value)

    @field_validator("script_hotkeys")
    @classmethod
    def validate_script_hotkeys(cls, value: dict[UUID, str]) -> dict[UUID, str]:
        return normalize_script_hotkeys(value)

    @model_validator(mode="after")
    def validate_unique_hotkeys(self) -> "ApplicationSettingsUpdate":
        ensure_unique_hotkeys(
            [
                self.emergency_stop_hotkey,
                self.record_start_hotkey,
                self.record_stop_hotkey,
                self.playback_start_hotkey,
                self.playback_stop_hotkey,
                self.clicker_toggle_hotkey,
            ],
            self.script_hotkeys,
        )
        return self

    def to_settings(self) -> ApplicationSettings:
        return ApplicationSettings.model_validate(self.model_dump())


class HotkeyValidationRequest(ApiModel):
    hotkey: str

    @field_validator("hotkey")
    @classmethod
    def validate_hotkey(cls, value: str) -> str:
        return normalize_hotkey(value)


class HotkeyValidationResponse(ApiModel):
    valid: Literal[True] = True
    normalized_hotkey: str
    availability: Literal["available", "unavailable"]
    reason: str | None = None