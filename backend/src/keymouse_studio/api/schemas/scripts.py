from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from keymouse_studio.api.schemas.actions import ScriptAction
from keymouse_studio.api.schemas.common import ApiModel
from keymouse_studio.domain.enums import LoopMode

CURRENT_SCHEMA_VERSION = 1


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timestamp must include a timezone")
    return value.astimezone(UTC)


class ScriptSettings(ApiModel):
    speed_multiplier: Annotated[float, Field(gt=0, le=100)] = 1.0
    loop_mode: LoopMode = LoopMode.COUNT
    loop_count: Annotated[int, Field(ge=1, le=1_000_000)] = 1
    countdown_ms: Annotated[int, Field(ge=0, le=86_400_000)] = 3000

    @model_validator(mode="after")
    def validate_loop_count(self) -> "ScriptSettings":
        if self.loop_mode == LoopMode.INFINITE and self.loop_count != 1:
            raise ValueError("loopCount must be 1 when loopMode is infinite")
        return self


class Script(ApiModel):
    schema_version: Literal[1] = 1
    id: UUID
    name: Annotated[str, Field(min_length=1, max_length=200)]
    description: Annotated[str, Field(max_length=2000)] = ""
    created_at: datetime
    updated_at: datetime
    settings: ScriptSettings = Field(default_factory=ScriptSettings)
    actions: Annotated[list[ScriptAction], Field(max_length=100_000)] = Field(default_factory=list)

    @field_validator("created_at", "updated_at")
    @classmethod
    def validate_timestamp(cls, value: datetime) -> datetime:
        return _ensure_utc(value)

    @model_validator(mode="after")
    def validate_timestamps(self) -> "Script":
        if self.updated_at < self.created_at:
            raise ValueError("updatedAt must not be before createdAt")
        return self


class ScriptCreate(ApiModel):
    name: Annotated[str, Field(min_length=1, max_length=200)]
    description: Annotated[str, Field(max_length=2000)] = ""
    settings: ScriptSettings = Field(default_factory=ScriptSettings)
    actions: Annotated[list[ScriptAction], Field(max_length=100_000)] = Field(default_factory=list)


class ScriptUpdate(Script):
    pass


class ScriptValidationRequest(ApiModel):
    script: dict[str, Any]


class ScriptValidationResponse(ApiModel):
    valid: Literal[True] = True
    script: Script
