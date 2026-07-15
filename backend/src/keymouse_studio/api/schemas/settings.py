from typing import Annotated, Literal

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
}
_MODIFIERS = set(_MODIFIER_ORDER)
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


def normalize_hotkey(value: str) -> str:
    parts = [
        _MODIFIER_ALIASES.get(part.strip().lower(), part.strip().lower())
        for part in value.split("+")
    ]
    if not parts or any(not part for part in parts) or len(set(parts)) != len(parts):
        raise ValueError("hotkey must contain unique non-empty keys")
    keys = [part for part in parts if part not in _MODIFIERS]
    if len(keys) != 1:
        raise ValueError("hotkey must contain exactly one non-modifier key")
    key = keys[0]
    if not (len(key) == 1 and key.isalnum()) and key not in _NAMED_KEYS:
        raise ValueError("hotkey contains an unsupported key")
    modifiers = [modifier for modifier in _MODIFIER_ORDER if modifier in parts]
    return "+".join([*modifiers, key])


def normalize_optional_hotkey(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        return ""
    return normalize_hotkey(trimmed)


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

    @field_validator("emergency_stop_hotkey")
    @classmethod
    def validate_emergency_stop_hotkey(cls, value: str) -> str:
        return normalize_hotkey(value)

    @field_validator(
        "record_start_hotkey",
        "record_stop_hotkey",
        "playback_start_hotkey",
        "playback_stop_hotkey",
    )
    @classmethod
    def validate_optional_hotkey(cls, value: str) -> str:
        return normalize_optional_hotkey(value)

    @model_validator(mode="after")
    def validate_unique_hotkeys(self) -> "ApplicationSettings":
        values = [
            self.emergency_stop_hotkey,
            self.record_start_hotkey,
            self.record_stop_hotkey,
            self.playback_start_hotkey,
            self.playback_stop_hotkey,
        ]
        non_empty = [item for item in values if item]
        if len(non_empty) != len(set(non_empty)):
            raise ValueError("hotkeys must be unique when configured")
        return self


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

    @field_validator("emergency_stop_hotkey")
    @classmethod
    def validate_emergency_stop_hotkey(cls, value: str) -> str:
        return normalize_hotkey(value)

    @field_validator(
        "record_start_hotkey",
        "record_stop_hotkey",
        "playback_start_hotkey",
        "playback_stop_hotkey",
    )
    @classmethod
    def validate_optional_hotkey(cls, value: str) -> str:
        return normalize_optional_hotkey(value)

    @model_validator(mode="after")
    def validate_unique_hotkeys(self) -> "ApplicationSettingsUpdate":
        values = [
            self.emergency_stop_hotkey,
            self.record_start_hotkey,
            self.record_stop_hotkey,
            self.playback_start_hotkey,
            self.playback_stop_hotkey,
        ]
        non_empty = [item for item in values if item]
        if len(non_empty) != len(set(non_empty)):
            raise ValueError("hotkeys must be unique when configured")
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