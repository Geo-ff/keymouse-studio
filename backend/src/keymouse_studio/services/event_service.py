import asyncio
from datetime import UTC, datetime
from uuid import UUID, uuid4

from keymouse_studio.api.schemas.events import EventEnvelope
from keymouse_studio.api.schemas.operations import EventPayload


class EventService:
    def __init__(self, protocol_version: int) -> None:
        self._protocol_version = protocol_version
        self._sequence = 0
        self._lock = asyncio.Lock()

    @property
    def sequence(self) -> int:
        return self._sequence

    async def create(
        self,
        event_type: str,
        payload: EventPayload,
        operation_id: UUID | None = None,
    ) -> EventEnvelope:
        async with self._lock:
            self._sequence += 1
            return EventEnvelope(
                protocol_version=self._protocol_version,
                event_id=uuid4(),
                sequence=self._sequence,
                timestamp=datetime.now(UTC),
                operation_id=operation_id,
                type=event_type,
                payload=payload,
            )
