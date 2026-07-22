from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from keymouse_studio.api.schemas.actions import KeyPayload
from keymouse_studio.api.schemas.common import ApiModel
from keymouse_studio.domain.enums import (
    ClickerInputType,
    EngineState,
    LoopMode,
    MouseButton,
    PositionMode,
)
from keymouse_studio.infrastructure.input.key_codes import (
    is_modifier_key,
    normalize_key_code,
    validate_key_code,
)

MAX_WAIT_MS = 86_400_000
MAX_KEYBOARD_KEYS = 5


class ClickerConfig(ApiModel):
    input_type: ClickerInputType = ClickerInputType.MOUSE
    button: MouseButton = MouseButton.LEFT
    click_count: Literal[1, 2] = 1
    interval_ms: int = Field(default=100, ge=50, le=MAX_WAIT_MS)
    repeat_mode: LoopMode = LoopMode.COUNT
    repeat_count: int = Field(default=1, ge=1, le=1_000_000)
    position_mode: PositionMode = PositionMode.CURRENT
    x: int | None = Field(default=None, ge=-2_147_483_648, le=2_147_483_647)
    y: int | None = Field(default=None, ge=-2_147_483_648, le=2_147_483_647)
    countdown_ms: int = Field(default=0, ge=0, le=MAX_WAIT_MS)
    keys: list[KeyPayload] = Field(default_factory=list, max_length=MAX_KEYBOARD_KEYS)
    press_duration_ms: int = Field(default=30, ge=10, le=60_000)

    @model_validator(mode="after")
    def validate_modes(self) -> "ClickerConfig":
        if self.repeat_mode == LoopMode.INFINITE and self.repeat_count != 1:
            raise ValueError("repeatCount must be 1 for infinite mode")

        if self.input_type == ClickerInputType.MOUSE:
            if self.keys:
                raise ValueError("keys are only allowed for keyboard input type")
            if self.position_mode == PositionMode.FIXED and (self.x is None or self.y is None):
                raise ValueError("x and y are required for fixed position mode")
            if self.position_mode == PositionMode.CURRENT and (
                self.x is not None or self.y is not None
            ):
                raise ValueError("x and y are only allowed for fixed position mode")
            return self

        if not self.keys:
            raise ValueError("keys are required for keyboard input type")
        if self.x is not None or self.y is not None:
            raise ValueError("x and y are only allowed for mouse fixed position mode")
        if self.position_mode != PositionMode.CURRENT:
            raise ValueError("keyboard input type only supports current position mode")

        normalized_codes: list[str] = []
        for key in self.keys:
            code = validate_key_code(key.key_code, key.scan_code)
            normalized_codes.append(code)

        if len(normalized_codes) != len(set(normalized_codes)):
            raise ValueError("duplicate keys are not allowed")

        modifiers = [code for code in normalized_codes if is_modifier_key(code)]
        primaries = [code for code in normalized_codes if not is_modifier_key(code)]
        if not primaries:
            raise ValueError("keyboard combination must include a non-modifier primary key")
        if len(primaries) > 1:
            raise ValueError("keyboard combination allows at most one primary key")
        if len(modifiers) > 4:
            raise ValueError("keyboard combination allows at most four modifiers")

        # Normalize key codes for downstream adapters.
        for key, code in zip(self.keys, normalized_codes, strict=True):
            key.key_code = normalize_key_code(code) if code else key.key_code
            if key.scan_code is None and key.key_code in {
                "alt_r",
                "ctrl_r",
                "delete",
                "down",
                "end",
                "home",
                "insert",
                "left",
                "page_down",
                "page_up",
                "right",
                "up",
                "win",
                "win_l",
                "win_r",
            }:
                key.extended = True

        return self


class TimedClickConfig(ClickerConfig):
    delay_ms: int = Field(ge=0, le=MAX_WAIT_MS)


class EmergencyStopResponse(ApiModel):
    operation_id: UUID | None = None
    state: EngineState = EngineState.IDLE
    released_input_count: int = 0
    release_failures: list[str] = Field(default_factory=list)
