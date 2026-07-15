from typing import Annotated
from uuid import UUID

from pydantic import Field, model_validator

from keymouse_studio.api.schemas.common import ApiModel
from keymouse_studio.api.schemas.operations import OperationTransition
from keymouse_studio.api.schemas.scripts import Script
from keymouse_studio.domain.enums import LoopMode


class PlaybackRequest(ApiModel):
    script_id: UUID | None = None
    inline_script: Script | None = None
    speed_multiplier: Annotated[float, Field(gt=0, le=100)] | None = None
    loop_mode: LoopMode | None = None
    loop_count: Annotated[int, Field(ge=1, le=1_000_000)] | None = None
    loop_duration_ms: Annotated[int, Field(ge=1, le=86_400_000)] | None = None
    countdown_ms: Annotated[int, Field(ge=0, le=86_400_000)] | None = None

    @model_validator(mode="after")
    def validate_source_and_loop(self) -> "PlaybackRequest":
        if (self.script_id is None) == (self.inline_script is None):
            raise ValueError("Exactly one of scriptId or inlineScript is required")
        mode = self.loop_mode or (
            self.inline_script.settings.loop_mode if self.inline_script is not None else None
        )
        if mode == LoopMode.INFINITE and self.loop_count not in {None, 1}:
            raise ValueError("loopCount must be 1 for infinite mode")
        return self


class PlaybackStartResponse(OperationTransition):
    pass
