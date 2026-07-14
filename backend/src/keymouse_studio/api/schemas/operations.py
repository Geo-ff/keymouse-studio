from datetime import datetime
from typing import Any
from uuid import UUID

from keymouse_studio.api.schemas.common import ApiModel, ErrorDetail
from keymouse_studio.domain.enums import EngineState, OperationType


class StateSnapshot(ApiModel):
    operation_id: UUID | None = None
    operation_type: OperationType | None = None
    state: EngineState = EngineState.IDLE
    sequence: int = 0
    started_at: datetime | None = None
    elapsed_ms: int = 0
    progress: float | None = None
    current_action_index: int | None = None
    completed_count: int = 0
    countdown_remaining_ms: int = 0
    error: ErrorDetail | None = None


class OperationTransition(ApiModel):
    operation_id: UUID
    state: EngineState
    snapshot: StateSnapshot


EventPayload = dict[str, Any] | StateSnapshot
