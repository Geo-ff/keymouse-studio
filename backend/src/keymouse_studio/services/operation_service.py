import asyncio
from contextlib import suppress
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
        self._elapsed_ms = 0
        self._progress: float | None = None
        self._current_action_index: int | None = None
        self._completed_count = 0
        self._countdown_remaining_ms = 0

    @property
    def operation_id(self) -> UUID | None:
        return self._operation_id

    @property
    def state(self) -> EngineState:
        return self._machine.state

    def snapshot(self) -> StateSnapshot:
        return StateSnapshot(
            operation_id=self._operation_id,
            operation_type=self._operation_type,
            state=self._machine.state,
            sequence=self._events.sequence,
            started_at=self._started_at,
            elapsed_ms=self._elapsed_ms,
            progress=self._progress,
            current_action_index=self._current_action_index,
            completed_count=self._completed_count,
            countdown_remaining_ms=self._countdown_remaining_ms,
        )

    async def start(
        self,
        operation_type: OperationType,
        initial_state: EngineState,
        countdown_remaining_ms: int = 0,
    ) -> StateSnapshot:
        async with self._lock:
            if self._machine.state != EngineState.IDLE:
                raise AppError(
                    ErrorCode.OPERATION_CONFLICT,
                    "当前已有任务在运行, 请先停止后再开始",
                    status_code=409,
                    operation_id=str(self._operation_id) if self._operation_id else None,
                )
            self._operation_id = uuid4()
            self._operation_type = operation_type
            self._started_at = datetime.now(UTC)
            self._elapsed_ms = 0
            self._progress = None
            self._current_action_index = None
            self._completed_count = 0
            self._countdown_remaining_ms = max(0, countdown_remaining_ms)
            self._machine.transition(initial_state)
            await self._publish("operation.state_changed")
            return self.snapshot()

    async def transition(
        self, target: EngineState, operation_id: UUID | None = None
    ) -> StateSnapshot:
        async with self._lock:
            self._require_operation(operation_id)
            self._machine.transition(target)
            if target == EngineState.IDLE:
                self._clear()
            await self._publish("operation.state_changed")
            return self.snapshot()

    async def resume(self, operation_id: UUID | None = None) -> StateSnapshot:
        async with self._lock:
            self._require_operation(operation_id)
            self._machine.resume()
            await self._publish("operation.state_changed")
            return self.snapshot()

    async def update_progress(
        self,
        *,
        elapsed_ms: int,
        completed_count: int,
        progress: float | None,
        countdown_remaining_ms: int = 0,
        current_action_index: int | None = None,
        operation_id: UUID | None = None,
    ) -> StateSnapshot:
        async with self._lock:
            self._require_operation(operation_id)
            self._elapsed_ms = max(0, elapsed_ms)
            self._completed_count = max(0, completed_count)
            self._progress = progress
            self._current_action_index = current_action_index
            self._countdown_remaining_ms = max(0, countdown_remaining_ms)
            await self._publish("operation.progress")
            return self.snapshot()

    async def fail(self, operation_id: UUID, exc: Exception) -> StateSnapshot:
        async with self._lock:
            self._require_operation(operation_id)
            self._machine.transition(EngineState.ERROR)
            with suppress(Exception):
                await self._events.create(
                    "error.raised",
                    {
                        "code": ErrorCode.ENGINE_INTERNAL_ERROR,
                        "message": "输入操作失败",
                        "details": {"exceptionType": type(exc).__name__},
                    },
                    operation_id,
                )
            await self._publish("operation.state_changed")
            return self.snapshot()

    async def publish_error(
        self,
        *,
        code: ErrorCode,
        message: str,
        details: dict[str, object] | None = None,
        retryable: bool = True,
        operation_id: UUID | None = None,
    ) -> None:
        async with self._lock:
            self._require_operation(operation_id)
            active_id = self._operation_id
            with suppress(Exception):
                await self._events.create(
                    "error.raised",
                    {
                        "code": code,
                        "message": message,
                        "details": details or {},
                        "retryable": retryable,
                        "operationId": str(active_id) if active_id else None,
                    },
                    active_id,
                )

    async def snapshot_event(self) -> EventEnvelope:
        snapshot = self.snapshot()
        event = await self._events.create_private(
            "engine.state_snapshot",
            snapshot,
            self._operation_id,
        )
        snapshot.sequence = event.sequence
        event.payload = snapshot
        return event

    def require_operation(self, operation_id: UUID) -> None:
        self._require_operation(operation_id)

    async def _publish(self, event_type: str) -> None:
        snapshot = self.snapshot()
        with suppress(Exception):
            event = await self._events.create(event_type, snapshot, self._operation_id)
            snapshot.sequence = event.sequence

    def _require_operation(self, operation_id: UUID | None) -> None:
        if operation_id is not None and operation_id != self._operation_id:
            raise AppError(
                ErrorCode.OPERATION_CONFLICT,
                "操作编号与当前任务不匹配",
                status_code=409,
                operation_id=str(self._operation_id) if self._operation_id else None,
            )

    def _clear(self) -> None:
        self._operation_id = None
        self._operation_type = None
        self._started_at = None
        self._elapsed_ms = 0
        self._progress = None
        self._current_action_index = None
        self._completed_count = 0
        self._countdown_remaining_ms = 0
