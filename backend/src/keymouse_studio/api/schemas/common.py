from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=lambda name: _to_camel(name), populate_by_name=True)


def _to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ErrorDetail(ApiModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
    retryable: bool = False
    operation_id: str | None = None


class ErrorResponse(ApiModel):
    error: ErrorDetail


class EngineState(StrEnum):
    IDLE = "idle"


class StateSnapshot(ApiModel):
    operation_id: str | None = None
    operation_type: str | None = None
    state: EngineState = EngineState.IDLE
    sequence: int = 0
    started_at: datetime | None = None
    elapsed_ms: int = 0
    progress: float | None = None
    current_action_index: int | None = None
    completed_count: int = 0
    countdown_remaining_ms: int = 0
    error: ErrorDetail | None = None


class HealthResponse(ApiModel):
    status: Literal["ok"] = "ok"
    app_version: str
    protocol_version: int
    engine_state: EngineState = EngineState.IDLE


class CapabilitiesResponse(ApiModel):
    platform: Literal["windows"] = "windows"
    input_available: bool = False
    global_hotkey_available: bool = False
    display_count: int = 0
    dpi_aware: bool = False


class StateEvent(ApiModel):
    protocol_version: int
    type: Literal["engine.state_snapshot"] = "engine.state_snapshot"
    payload: StateSnapshot
