import asyncio
from contextlib import suppress
from uuid import UUID

from keymouse_studio.api.schemas.clicker import EmergencyStopResponse
from keymouse_studio.api.schemas.operations import OperationTransition
from keymouse_studio.api.schemas.recording import RecordingStopResponse
from keymouse_studio.domain.enums import EngineState, OperationType
from keymouse_studio.infrastructure.input.adapter import InputWorker, ReleaseResult
from keymouse_studio.services.clicker_service import ClickerService
from keymouse_studio.services.operation_service import OperationService
from keymouse_studio.services.playback_service import PlaybackService
from keymouse_studio.services.recording_service import RecordingService


class AutomationCoordinator:
    def __init__(
        self,
        operations: OperationService,
        clicker: ClickerService,
        recording: RecordingService,
        playback: PlaybackService,
        input_worker: InputWorker,
    ) -> None:
        self._operations = operations
        self._clicker = clicker
        self._recording = recording
        self._playback = playback
        self._input = input_worker

    async def pause(self, operation_id: UUID) -> OperationTransition:
        return await self._service().pause(operation_id)

    async def resume(self, operation_id: UUID) -> OperationTransition:
        return await self._service().resume(operation_id)

    async def stop(self, operation_id: UUID) -> OperationTransition | RecordingStopResponse:
        if self._recording.has_stopped(operation_id):
            return await self._recording.stop(operation_id)
        # Idle: treat stop as idempotent success (avoids stale operationId 409).
        if self._operations.operation_id is None:
            snapshot = self._operations.snapshot()
            return OperationTransition(
                operation_id=operation_id, state=snapshot.state, snapshot=snapshot
            )
        return await self._service().stop(operation_id)

    async def emergency_stop(self) -> EmergencyStopResponse:
        operation_id = self._operations.operation_id
        operation_type = self._operations.snapshot().operation_type
        # Always halt injection loops even if operation_id is desynced.
        self._clicker.cancel()
        self._playback.cancel()
        release_task = asyncio.create_task(self._safe_release())
        service = self._service() if operation_id is not None else None
        if service is None and operation_type is None:
            # Prefer clicker stop path when type unknown but a loop may still be alive.
            service = self._clicker
        released = await release_task
        if operation_id is not None and service is not None:
            try:
                await service.stop(operation_id)
            except Exception as exc:
                released = self._merge_release(
                    released,
                    ReleaseResult(failures=(f"stop:{type(exc).__name__}",)),
                )
            if operation_type in {OperationType.CLICKER, OperationType.TIMED_CLICK}:
                released = self._merge_release(released, self._clicker.release_result(operation_id))
            elif operation_type == OperationType.PLAYBACK:
                released = self._merge_release(
                    released,
                    self._playback.release_result(operation_id),
                )
        # Ensure background tasks fully exit even when operation_id was already cleared.
        await asyncio.gather(
            self._clicker.wait_finished(),
            self._playback.wait_finished(),
            return_exceptions=True,
        )
        if self._operations.operation_id is not None:
            active_id = self._operations.operation_id
            with suppress(Exception):
                if self._operations.state not in {EngineState.IDLE, EngineState.STOPPING}:
                    await self._operations.transition(EngineState.STOPPING, active_id)
                if self._operations.state == EngineState.STOPPING:
                    await self._operations.transition(EngineState.IDLE, active_id)
        return EmergencyStopResponse(
            operation_id=operation_id,
            state=self._operations.state,
            released_input_count=released.released_count,
            release_failures=list(released.failures),
        )

    def _service(self) -> ClickerService | RecordingService | PlaybackService:
        operation_type = self._operations.snapshot().operation_type
        if operation_type in {OperationType.CLICKER, OperationType.TIMED_CLICK}:
            return self._clicker
        if operation_type == OperationType.RECORDING:
            return self._recording
        if operation_type == OperationType.PLAYBACK:
            return self._playback
        return self._clicker

    async def _safe_release(self) -> ReleaseResult:
        try:
            return await self._input.release_all()
        except Exception as exc:
            return ReleaseResult(failures=(f"release_all:{type(exc).__name__}",))

    def _merge_release(self, first: ReleaseResult, second: ReleaseResult) -> ReleaseResult:
        return ReleaseResult(
            released_count=first.released_count + second.released_count,
            failures=first.failures + second.failures,
        )
