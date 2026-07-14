import asyncio
from datetime import UTC, datetime
from uuid import UUID, uuid4

from keymouse_studio.api.schemas.events import EventEnvelope
from keymouse_studio.api.schemas.operations import StateSnapshot
from keymouse_studio.domain.enums import EngineState, OperationType
from keymouse_studio.domain.errors import AppError, ErrorCode
from keymouse_studio.domain.state_machine import OperationStateMachine
from keymouse_studio.services.event_service import EventService


class OperationService:
    def __init__(self, event_service: EventService) -> None:
        self._events = event_service
        self._machine = OperationStateMachine()
        self._lock = asyncio.Lock()
        self._operation_id: UUID | None = None
        self._operation_type: OperationType | None = None
        self._started_at: datetime | None = None

    def snapshot(self) -> StateSnapshot:
        return StateSnapshot(
            operation_id=self._operation_id,
            operation_type=self._operation_type,
            state=self._machine.state,
            sequence=self._events.sequence,
            started_at=self._started_at,
        )

    async def start(
        self, operation_type: OperationType, initial_state: EngineState
    ) -> StateSnapshot:
        async with self._lock:
            if self._machine.state != EngineState.IDLE:
                raise AppError(
                    ErrorCode.OPERATION_CONFLICT,
                    "Another operation is already active",
                    status_code=409,
                    operation_id=str(self._operation_id) if self._operation_id else None,
                )
            self._operation_id = uuid4()
            self._operation_type = operation_type
            self._started_at = datetime.now(UTC)
            self._machine.transition(initial_state)
            await self._publish_state()
            return self.snapshot()

    async def transition(self, target: EngineState) -> StateSnapshot:
        async with self._lock:
            self._machine.transition(target)
            await self._publish_state()
            if target == EngineState.IDLE:
                self._operation_id = None
                self._operation_type = None
                self._started_at = None
            return self.snapshot()

    async def resume(self) -> StateSnapshot:
        async with self._lock:
            self._machine.resume()
            await self._publish_state()
            return self.snapshot()

    async def snapshot_event(self) -> EventEnvelope:
        snapshot = self.snapshot()
        event = await self._events.create("engine.state_snapshot", snapshot, self._operation_id)
        snapshot.sequence = event.sequence
        event.payload = snapshot
        return event

    async def _publish_state(self) -> None:
        snapshot = self.snapshot()
        event = await self._events.create("operation.state_changed", snapshot, self._operation_id)
        snapshot.sequence = event.sequence
