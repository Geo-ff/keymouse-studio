from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from keymouse_studio.domain.enums import EngineState


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=lambda name: _to_camel(name),
        populate_by_name=True,
        extra="forbid",
    )


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
