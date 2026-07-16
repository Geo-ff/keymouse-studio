from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from keymouse_studio.api.schemas.common import ApiModel
from keymouse_studio.domain.enums import EngineState, LoopMode, MouseButton, PositionMode

MAX_WAIT_MS = 86_400_000


class ClickerConfig(ApiModel):
    button: MouseButton = MouseButton.LEFT
    click_count: Literal[1, 2] = 1
    interval_ms: int = Field(default=100, ge=50, le=MAX_WAIT_MS)
    repeat_mode: LoopMode = LoopMode.COUNT
    repeat_count: int = Field(default=1, ge=1, le=1_000_000)
    position_mode: PositionMode = PositionMode.CURRENT
    x: int | None = Field(default=None, ge=-2_147_483_648, le=2_147_483_647)
    y: int | None = Field(default=None, ge=-2_147_483_648, le=2_147_483_647)
    countdown_ms: int = Field(default=0, ge=0, le=MAX_WAIT_MS)

    @model_validator(mode="after")
    def validate_modes(self) -> "ClickerConfig":
        if self.position_mode == PositionMode.FIXED and (self.x is None or self.y is None):
            raise ValueError("x and y are required for fixed position mode")
        if self.position_mode == PositionMode.CURRENT and (
            self.x is not None or self.y is not None
        ):
            raise ValueError("x and y are only allowed for fixed position mode")
        if self.repeat_mode == LoopMode.INFINITE and self.repeat_count != 1:
            raise ValueError("repeatCount must be 1 for infinite mode")
        return self


class TimedClickConfig(ClickerConfig):
    delay_ms: int = Field(ge=0, le=MAX_WAIT_MS)


class EmergencyStopResponse(ApiModel):
    operation_id: UUID | None = None
    state: EngineState = EngineState.IDLE
    released_input_count: int = 0
    release_failures: list[str] = Field(default_factory=list)
