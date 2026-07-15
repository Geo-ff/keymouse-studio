import asyncio
from contextlib import suppress
from uuid import UUID

from keymouse_studio.api.schemas.clicker import (
    ClickerConfig,
    EmergencyStopResponse,
    TimedClickConfig,
)
from keymouse_studio.api.schemas.operations import OperationTransition
from keymouse_studio.domain.enums import EngineState, LoopMode, OperationType, PositionMode
from keymouse_studio.domain.errors import AppError, ErrorCode
from keymouse_studio.infrastructure.input.adapter import InputWorker, ReleaseResult
from keymouse_studio.infrastructure.system.clock import Clock
from keymouse_studio.services.operation_service import OperationService


class ClickerService:
    def __init__(
        self,
        operations: OperationService,
        input_worker: InputWorker,
        clock: Clock,
        poll_interval_ms: int = 25,
    ) -> None:
        self._operations = operations
        self._input = input_worker
        self._clock = clock
        self._poll_seconds = poll_interval_ms / 1000
        self._cancelled = asyncio.Event()
        self._running = asyncio.Event()
        self._running.set()
        self._task: asyncio.Task[None] | None = None
        self._last_operation_id: UUID | None = None
        self._elapsed_ns = 0
        self._release_results: dict[UUID, ReleaseResult] = {}

    async def start_clicker(self, config: ClickerConfig) -> OperationTransition:
        return await self._start(OperationType.CLICKER, config, 0)

    async def start_timed_click(self, config: TimedClickConfig) -> OperationTransition:
        return await self._start(OperationType.TIMED_CLICK, config, config.delay_ms)

    async def pause(self, operation_id: UUID) -> OperationTransition:
        self._operations.require_operation(operation_id)
        self._running.clear()
        snapshot = await self._operations.transition(EngineState.PAUSED, operation_id)
        return OperationTransition(
            operation_id=operation_id, state=snapshot.state, snapshot=snapshot
        )

    async def resume(self, operation_id: UUID) -> OperationTransition:
        self._operations.require_operation(operation_id)
        snapshot = await self._operations.resume(operation_id)
        self._running.set()
        return OperationTransition(
            operation_id=operation_id, state=snapshot.state, snapshot=snapshot
        )

    def cancel(self) -> None:
        self._cancelled.set()
        self._running.set()

    def release_result(self, operation_id: UUID) -> ReleaseResult:
        return self._release_results.pop(operation_id, ReleaseResult())

    async def stop(self, operation_id: UUID) -> OperationTransition:
        if self._operations.operation_id is None and operation_id == self._last_operation_id:
            snapshot = self._operations.snapshot()
            return OperationTransition(
                operation_id=operation_id, state=snapshot.state, snapshot=snapshot
            )
        self._operations.require_operation(operation_id)
        self.cancel()
        if self._operations.state != EngineState.STOPPING:
            await self._operations.transition(EngineState.STOPPING, operation_id)
        await self._wait_for_task()
        snapshot = self._operations.snapshot()
        return OperationTransition(
            operation_id=operation_id, state=snapshot.state, snapshot=snapshot
        )

    async def emergency_stop(self) -> EmergencyStopResponse:
        operation_id = self._operations.operation_id
        self._cancelled.set()
        self._running.set()
        if operation_id is not None and self._operations.state not in {
            EngineState.IDLE,
            EngineState.STOPPING,
        }:
            await self._operations.transition(EngineState.STOPPING, operation_id)
        release_result = await self._input.release_all()
        await self._wait_for_task()
        return EmergencyStopResponse(
            operation_id=operation_id,
            state=self._operations.state,
            released_input_count=release_result.released_count,
            release_failures=list(release_result.failures),
        )

    async def shutdown(self) -> None:
        operation_id = self._operations.operation_id
        if operation_id is not None and self._operations.snapshot().operation_type in {
            OperationType.CLICKER,
            OperationType.TIMED_CLICK,
        }:
            await self.stop(operation_id)

    async def wait_finished(self) -> None:
        await self._wait_for_task()

    async def _start(
        self, operation_type: OperationType, config: ClickerConfig, delay_ms: int
    ) -> OperationTransition:
        if self._task is not None and not self._task.done():
            raise AppError(
                ErrorCode.OPERATION_CONFLICT,
                "Another operation is already active",
                status_code=409,
            )
        initial_wait_ms = config.countdown_ms + delay_ms
        initial_state = EngineState.COUNTDOWN if initial_wait_ms else EngineState.RUNNING
        snapshot = await self._operations.start(operation_type, initial_state)
        operation_id = snapshot.operation_id
        if operation_id is None:
            raise RuntimeError("Operation service did not create an operation id")
        self._cancelled = asyncio.Event()
        self._running = asyncio.Event()
        self._running.set()
        self._last_operation_id = operation_id
        self._elapsed_ns = 0
        self._task = asyncio.create_task(
            self._run(operation_id, config, initial_wait_ms),
            name=f"{operation_type}-{operation_id}",
        )
        return OperationTransition(
            operation_id=operation_id, state=snapshot.state, snapshot=snapshot
        )

    async def _run(self, operation_id: UUID, config: ClickerConfig, initial_wait_ms: int) -> None:
        completed = 0
        try:
            if initial_wait_ms:
                await self._wait(initial_wait_ms, completed, initial_wait_ms)
                self._raise_if_cancelled()
                await self._operations.transition(EngineState.RUNNING, operation_id)
            total = config.repeat_count if config.repeat_mode == LoopMode.COUNT else None
            while total is None or completed < total:
                self._raise_if_cancelled()
                await self._running.wait()
                if config.position_mode == PositionMode.FIXED:
                    if config.x is None or config.y is None:
                        raise RuntimeError("Fixed position coordinates are missing")
                    await self._input.move(config.x, config.y)
                for _ in range(config.click_count):
                    await self._click(config)
                completed += 1
                progress = completed / total if total is not None else None
                await self._publish_progress(completed, progress)
                if total is None or completed < total:
                    await self._wait(config.interval_ms, completed, 0)
        except asyncio.CancelledError:
            self._cancelled.set()
            raise
        except Exception as exc:
            await self._operations.fail(operation_id, exc)
        finally:
            self._release_results[operation_id] = await self._safe_release()
            if self._operations.operation_id == operation_id:
                if self._operations.state != EngineState.STOPPING:
                    with suppress(AppError):
                        await self._operations.transition(EngineState.STOPPING, operation_id)
                if self._operations.state == EngineState.STOPPING:
                    await self._operations.transition(EngineState.IDLE, operation_id)

    async def _click(self, config: ClickerConfig) -> None:
        await self._running.wait()
        self._raise_if_cancelled()
        await self._input.button_down(config.button)
        try:
            self._raise_if_cancelled()
        finally:
            await self._input.button_up(config.button)

    async def _wait(self, duration_ms: int, completed: int, countdown_ms: int) -> None:
        remaining_ns = duration_ms * 1_000_000
        while remaining_ns > 0:
            self._raise_if_cancelled()
            await self._running.wait()
            self._raise_if_cancelled()
            slice_seconds = min(remaining_ns / 1_000_000_000, self._poll_seconds)
            before = self._clock.now_ns()
            await self._clock.sleep(slice_seconds)
            if not self._running.is_set():
                continue
            elapsed = min(max(0, self._clock.now_ns() - before), remaining_ns)
            remaining_ns -= elapsed
            self._elapsed_ns += elapsed
            if countdown_ms:
                await self._publish_progress(
                    completed,
                    None,
                    max(0, remaining_ns // 1_000_000),
                )

    async def _publish_progress(
        self, completed: int, progress: float | None, countdown_remaining_ms: int = 0
    ) -> None:
        await self._operations.update_progress(
            elapsed_ms=self._elapsed_ns // 1_000_000,
            completed_count=completed,
            progress=progress,
            countdown_remaining_ms=countdown_remaining_ms,
        )

    async def _safe_release(self) -> ReleaseResult:
        try:
            return await self._input.release_all()
        except Exception as exc:
            return ReleaseResult(failures=(f"release_all:{type(exc).__name__}",))

    def _raise_if_cancelled(self) -> None:
        if self._cancelled.is_set():
            raise asyncio.CancelledError

    async def _wait_for_task(self) -> None:
        if self._task is not None:
            with suppress(asyncio.CancelledError):
                await self._task
            self._task = None
