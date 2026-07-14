from datetime import datetime
from typing import Literal
from uuid import UUID

from keymouse_studio.api.schemas.common import ApiModel
from keymouse_studio.api.schemas.operations import EventPayload


class EventEnvelope(ApiModel):
    protocol_version: int
    event_id: UUID
    sequence: int
    timestamp: datetime
    operation_id: UUID | None = None
    type: str
    payload: EventPayload


class StateSnapshotEvent(EventEnvelope):
    type: Literal["engine.state_snapshot"] = "engine.state_snapshot"
