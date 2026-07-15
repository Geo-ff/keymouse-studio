from typing import Annotated
from uuid import UUID

from pydantic import Field

from keymouse_studio.api.schemas.actions import ScriptAction
from keymouse_studio.api.schemas.common import ApiModel
from keymouse_studio.api.schemas.operations import OperationTransition


class RecordingConfig(ApiModel):
    record_mouse_move: bool = True
    min_move_sample_ms: Annotated[int, Field(ge=1, le=1000)] = 10
    move_error_px: Annotated[float, Field(ge=0, le=100)] = 2.0
    record_wheel: bool = True
    record_mouse: bool = True
    record_keyboard: bool = True


class RecordingStartResponse(OperationTransition):
    pass


class RecordingStopResponse(OperationTransition):
    recording_result_id: UUID


class RecordingResult(ApiModel):
    id: UUID
    operation_id: UUID
    duration_ms: int
    action_count: int
    actions: list[ScriptAction]
