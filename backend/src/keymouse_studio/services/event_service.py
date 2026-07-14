import asyncio
from datetime import UTC, datetime
from uuid import UUID, uuid4

from keymouse_studio.api.schemas.events import EventEnvelope
from keymouse_studio.api.schemas.operations import EventPayload


class EventService:
    def __init__(self, protocol_version: int, subscriber_capacity: int = 256) -> None:
        self._protocol_version = protocol_version
        self._subscriber_capacity = subscriber_capacity
        self._sequence = 0
        self._lock = asyncio.Lock()
        self._subscribers: set[asyncio.Queue[EventEnvelope]] = set()

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
            event = EventEnvelope(
                protocol_version=self._protocol_version,
                event_id=uuid4(),
                sequence=self._sequence,
                timestamp=datetime.now(UTC),
                operation_id=operation_id,
                type=event_type,
                payload=payload,
            )
            for queue in self._subscribers:
                if queue.full():
                    queue.get_nowait()
                queue.put_nowait(event)
            return event

    def subscribe(self) -> asyncio.Queue[EventEnvelope]:
        queue: asyncio.Queue[EventEnvelope] = asyncio.Queue(self._subscriber_capacity)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[EventEnvelope]) -> None:
        self._subscribers.discard(queue)
