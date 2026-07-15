import asyncio
from contextlib import suppress
from uuid import UUID

from keymouse_studio.api.schemas.actions import (
    KeyDownAction,
    KeyUpAction,
    MouseButtonDownAction,
    MouseButtonUpAction,
    MouseClickAction,
    MouseMoveAction,
    MouseWheelAction,
    ScriptAction,
    WaitAction,
)
from keymouse_studio.api.schemas.operations import OperationTransition
from keymouse_studio.api.schemas.playback import PlaybackRequest
from keymouse_studio.api.schemas.scripts import Script
from keymouse_studio.domain.enums import EngineState, LoopMode, OperationType
from keymouse_studio.domain.errors import AppError, ErrorCode
from keymouse_studio.infrastructure.input.adapter import InputWorker, ReleaseResult
from keymouse_studio.infrastructure.system.clock import Clock
from keymouse_studio.services.operation_service import OperationService
from keymouse_studio.services.script_service import ScriptService


class PlaybackService:
    def __init__(
        self,
        operations: OperationService,
        scripts: ScriptService,
        input_worker: InputWorker,
        clock: Clock,
        poll_interval_ms: int = 25,
    ) -> None:
        self._operations = operations
        self._scripts = scripts
        self._input = input_worker
        self._clock = clock
        self._poll_seconds = poll_interval_ms / 1000
        self._running = asyncio.Event()
        self._running.set()
        self._cancelled = asyncio.Event()
        self._task: asyncio.Task[None] | None = None
        self._elapsed_ns = 0
        self._playback_started_ns: int | None = None
        self._pause_started_ns: int | None = None
        self._paused_ns = 0
        self._last_operation_id: UUID | None = None
        self._release_results: dict[UUID, ReleaseResult] = {}

    async def start(self, request: PlaybackRequest) -> OperationTransition:
        script = await self._resolve_script(request)
        enabled = [action for action in script.actions if action.enabled]
        playable = [
            action
            for action in enabled
            if not isinstance(action, WaitAction) or action.payload.duration_ms > 0
        ]
        if not playable:
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                "Playback script must contain at least one executable action",
                status_code=422,
            )
        countdown_ms = request.countdown_ms
        if countdown_ms is None:
            countdown_ms = script.settings.countdown_ms
        initial_state = EngineState.COUNTDOWN if countdown_ms else EngineState.RUNNING
        snapshot = await self._operations.start(OperationType.PLAYBACK, initial_state)
        operation_id = snapshot.operation_id
        if operation_id is None:
            raise RuntimeError("Operation service did not create an operation id")
        self._running = asyncio.Event()
        self._running.set()
        self._cancelled = asyncio.Event()
        self._elapsed_ns = 0
        self._playback_started_ns = None
        self._pause_started_ns = None
        self._paused_ns = 0
        self._last_operation_id = operation_id
        self._task = asyncio.create_task(
            self._run(operation_id, enabled, script, request, countdown_ms),
            name=f"playback-{operation_id}",
        )
        return OperationTransition(
            operation_id=operation_id, state=snapshot.state, snapshot=snapshot
        )

    async def pause(self, operation_id: UUID) -> OperationTransition:
        self._operations.require_operation(operation_id)
        self._running.clear()
        self._pause_started_ns = self._clock.now_ns()
        snapshot = await self._operations.transition(EngineState.PAUSED, operation_id)
        return OperationTransition(
            operation_id=operation_id, state=snapshot.state, snapshot=snapshot
        )

    async def resume(self, operation_id: UUID) -> OperationTransition:
        self._operations.require_operation(operation_id)
        if self._pause_started_ns is not None:
            self._paused_ns += max(0, self._clock.now_ns() - self._pause_started_ns)
            self._pause_started_ns = None
        snapshot = await self._operations.resume(operation_id)
        self._running.set()
        return OperationTransition(
            operation_id=operation_id, state=snapshot.state, snapshot=snapshot
        )

    def cancel(self) -> None:
        self._cancelled.set()
        self._running.set()

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

    async def shutdown(self) -> None:
        operation_id = self._operations.operation_id
        if (
            operation_id is not None
            and self._operations.snapshot().operation_type == OperationType.PLAYBACK
        ):
            await self.stop(operation_id)

    async def wait_finished(self) -> None:
        await self._wait_for_task()

    def release_result(self, operation_id: UUID) -> ReleaseResult:
        return self._release_results.pop(operation_id, ReleaseResult())

    async def _resolve_script(self, request: PlaybackRequest) -> Script:
        if request.inline_script is not None:
            return request.inline_script
        if request.script_id is None:
            raise RuntimeError("Playback source is missing")
        return await self._scripts.get(request.script_id)

    async def _run(
        self,
        operation_id: UUID,
        enabled: list[ScriptAction],
        script: Script,
        request: PlaybackRequest,
        countdown_ms: int,
    ) -> None:
        speed = request.speed_multiplier or script.settings.speed_multiplier
        loop_mode = request.loop_mode or script.settings.loop_mode
        loop_count = request.loop_count or script.settings.loop_count
        duration_ns = (
            request.loop_duration_ms * 1_000_000 if request.loop_duration_ms is not None else None
        )
        completed_loops = 0
        completed_actions = 0
        current_index: int | None = None
        total_actions = len(enabled) * loop_count if loop_mode == LoopMode.COUNT else None
        natural_completion = False
        try:
            if countdown_ms:
                await self._wait_countdown(countdown_ms, operation_id)
                self._raise_if_cancelled()
                self._elapsed_ns = 0
                await self._operations.transition(EngineState.RUNNING, operation_id)
            self._playback_started_ns = self._clock.now_ns()
            self._paused_ns = 0
            self._pause_started_ns = None
            while loop_mode == LoopMode.INFINITE or completed_loops < loop_count:
                if self._duration_reached(duration_ns):
                    natural_completion = True
                    break
                completed_round = True
                for index, action in enumerate(enabled):
                    self._raise_if_cancelled()
                    await self._running.wait()
                    if not await self._wait(action.delay_before_ms, speed, duration_ns):
                        completed_round = False
                        natural_completion = True
                        break
                    if not await self._execute(action, speed, duration_ns):
                        completed_round = False
                        natural_completion = True
                        break
                    current_index = index
                    completed_actions += 1
                    await self._publish_progress(
                        operation_id,
                        completed_loops,
                        completed_actions,
                        total_actions,
                        current_index,
                        duration_ns,
                    )
                if not completed_round:
                    break
                completed_loops += 1
                natural_completion = loop_mode == LoopMode.COUNT and completed_loops >= loop_count
                await self._publish_progress(
                    operation_id,
                    completed_loops,
                    completed_actions,
                    total_actions,
                    current_index,
                    duration_ns,
                )
            if natural_completion:
                await self._publish_final(
                    operation_id,
                    completed_loops,
                    current_index,
                    duration_ns,
                    loop_mode,
                )
        except asyncio.CancelledError:
            self.cancel()
            raise
        except Exception as exc:
            with suppress(Exception):
                await self._operations.fail(operation_id, exc)
        finally:
            self._release_results[operation_id] = await self._safe_release()
            await self._finish_state(operation_id)

    async def _execute(
        self,
        action: ScriptAction,
        speed: float,
        duration_ns: int | None,
    ) -> bool:
        self._raise_if_cancelled()
        if self._duration_reached(duration_ns):
            return False
        if isinstance(action, MouseMoveAction):
            if action.payload.duration_ms:
                if not await self._wait(action.payload.duration_ms, speed, duration_ns):
                    return False
            await self._input.move(action.payload.x, action.payload.y)
        elif isinstance(action, MouseButtonDownAction):
            await self._input.button_down(action.payload.button)
        elif isinstance(action, MouseButtonUpAction):
            await self._input.button_up(action.payload.button)
        elif isinstance(action, MouseClickAction):
            if action.payload.x is not None and action.payload.y is not None:
                await self._input.move(action.payload.x, action.payload.y)
            for click_index in range(action.payload.click_count):
                await self._input.button_down(action.payload.button)
                try:
                    self._raise_if_cancelled()
                finally:
                    await self._input.button_up(action.payload.button)
                if click_index + 1 < action.payload.click_count:
                    if not await self._wait(action.payload.interval_ms, speed, duration_ns):
                        return False
        elif isinstance(action, MouseWheelAction):
            await self._input.wheel(action.payload.delta_x, action.payload.delta_y)
        elif isinstance(action, KeyDownAction):
            await self._input.key_down(
                action.payload.key_code,
                action.payload.scan_code,
                action.payload.extended,
            )
        elif isinstance(action, KeyUpAction):
            await self._input.key_up(
                action.payload.key_code,
                action.payload.scan_code,
                action.payload.extended,
            )
        elif isinstance(action, WaitAction):
            return await self._wait(action.payload.duration_ms, speed, duration_ns)
        return not self._duration_reached(duration_ns)

    async def _wait(
        self,
        duration_ms: int,
        speed: float,
        duration_ns: int | None,
    ) -> bool:
        remaining_ns = int(duration_ms * 1_000_000 / speed)
        while remaining_ns > 0:
            self._raise_if_cancelled()
            await self._running.wait()
            self._raise_if_cancelled()
            budget_ns = remaining_ns
            if duration_ns is not None:
                budget_ns = min(budget_ns, max(0, duration_ns - self._elapsed_ns))
                if budget_ns == 0:
                    return False
            before = self._clock.now_ns()
            await self._clock.sleep(min(budget_ns / 1_000_000_000, self._poll_seconds))
            if not self._running.is_set():
                continue
            elapsed = min(max(0, self._clock.now_ns() - before), budget_ns)
            remaining_ns -= elapsed
            self._refresh_elapsed()
        return not self._duration_reached(duration_ns)

    async def _wait_countdown(self, duration_ms: int, operation_id: UUID) -> None:
        remaining_ns = duration_ms * 1_000_000
        while remaining_ns > 0:
            self._raise_if_cancelled()
            await self._running.wait()
            before = self._clock.now_ns()
            await self._clock.sleep(min(remaining_ns / 1_000_000_000, self._poll_seconds))
            if not self._running.is_set():
                continue
            elapsed = min(max(0, self._clock.now_ns() - before), remaining_ns)
            remaining_ns -= elapsed
            await self._operations.update_progress(
                elapsed_ms=0,
                completed_count=0,
                progress=None,
                countdown_remaining_ms=remaining_ns // 1_000_000,
                operation_id=operation_id,
            )

    async def _publish_progress(
        self,
        operation_id: UUID,
        completed_loops: int,
        completed_actions: int,
        total_actions: int | None,
        current_index: int | None,
        duration_ns: int | None,
    ) -> None:
        progress = completed_actions / total_actions if total_actions else None
        if duration_ns is not None:
            duration_progress = min(1.0, self._elapsed_ns / duration_ns)
            progress = max(progress or 0.0, duration_progress)
        await self._operations.update_progress(
            elapsed_ms=self._elapsed_ns // 1_000_000,
            completed_count=completed_loops,
            progress=progress,
            current_action_index=current_index,
            operation_id=operation_id,
        )

    async def _publish_final(
        self,
        operation_id: UUID,
        completed_loops: int,
        current_index: int | None,
        duration_ns: int | None,
        loop_mode: LoopMode,
    ) -> None:
        progress = 1.0 if loop_mode == LoopMode.COUNT or duration_ns is not None else None
        await self._operations.update_progress(
            elapsed_ms=self._elapsed_ns // 1_000_000,
            completed_count=completed_loops,
            progress=progress,
            current_action_index=current_index,
            operation_id=operation_id,
        )

    def _duration_reached(self, duration_ns: int | None) -> bool:
        self._refresh_elapsed()
        return duration_ns is not None and self._elapsed_ns >= duration_ns

    def _refresh_elapsed(self) -> None:
        if self._playback_started_ns is None:
            return
        now = self._pause_started_ns or self._clock.now_ns()
        self._elapsed_ns = max(
            0,
            now - self._playback_started_ns - self._paused_ns,
        )

    def _raise_if_cancelled(self) -> None:
        if self._cancelled.is_set():
            raise asyncio.CancelledError

    async def _safe_release(self) -> ReleaseResult:
        try:
            return await self._input.release_all()
        except Exception as exc:
            return ReleaseResult(failures=(f"release_all:{type(exc).__name__}",))

    async def _finish_state(self, operation_id: UUID) -> None:
        if self._operations.operation_id != operation_id:
            return
        if self._operations.state != EngineState.STOPPING:
            with suppress(Exception):
                await self._operations.transition(EngineState.STOPPING, operation_id)
        if self._operations.state == EngineState.STOPPING:
            with suppress(Exception):
                await self._operations.transition(EngineState.IDLE, operation_id)

    async def _wait_for_task(self) -> None:
        if self._task is not None:
            with suppress(asyncio.CancelledError):
                await self._task
            self._task = None
