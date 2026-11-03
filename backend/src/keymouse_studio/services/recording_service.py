import asyncio
from contextlib import suppress
from uuid import UUID, uuid4

from keymouse_studio.api.schemas.actions import ScriptAction
from keymouse_studio.api.schemas.operations import OperationTransition
from keymouse_studio.api.schemas.recording import (
    RecordingConfig,
    RecordingResult,
    RecordingStopResponse,
)
from keymouse_studio.domain.enums import EngineState, MouseMoveMode, OperationType
from keymouse_studio.domain.errors import AppError, ErrorCode
from keymouse_studio.infrastructure.input.listener import (
    EventSubscription,
    InputEventBridge,
    SubscriptionBarrier,
)
from keymouse_studio.services.action_normalizer import ActionNormalizer
from keymouse_studio.services.event_service import EventService
from keymouse_studio.services.operation_service import OperationService

RELATIVE_MOUSE_UNAVAILABLE_MESSAGE = (
    "无法开启「游戏视角 (相对移动)」录制: 系统未能注册原始鼠标输入。"
    "请改用「屏幕坐标」模式录制, 或重启 KeyMouse Studio 后重试。"
)


class RecordingService:
    def __init__(
        self,
        operations: OperationService,
        events: EventService,
        bridge: InputEventBridge,
    ) -> None:
        self._operations = operations
        self._events = events
        self._bridge = bridge
        self._paused = False
        self._task: asyncio.Task[None] | None = None
        self._subscriber: EventSubscription | None = None
        self._normalizer: ActionNormalizer | None = None
        self._results: dict[UUID, RecordingResult] = {}
        self._result_by_operation: dict[UUID, UUID] = {}
        self._stopped: dict[UUID, RecordingStopResponse] = {}
        self._started_ns = 0
        self._paused_ns = 0
        self._pause_started_ns: int | None = None
        self._pause_boundary_ns: int | None = None
        self._resume_boundary_ns: int | None = None
        self._published_count = 0
        self._stop_lock = asyncio.Lock()
        self._start_lock = asyncio.Lock()
        self._relative_mouse_active = False

    async def start(self, config: RecordingConfig) -> OperationTransition:
        async with self._start_lock:
            return await self._start(config)

    async def _start(self, config: RecordingConfig) -> OperationTransition:
        # Only switch the raw mouse listener on when no other operation is active; otherwise
        # operations.start() below rejects the request and nothing must be touched.
        enable_relative = (
            config.record_mouse
            and config.record_mouse_move
            and config.mouse_move_mode == MouseMoveMode.RELATIVE
            and self._operations.operation_id is None
        )
        if enable_relative:
            await self._enable_relative_mouse()
        try:
            snapshot = await self._operations.start(OperationType.RECORDING, EngineState.RECORDING)
        except BaseException:
            if enable_relative:
                await self._disable_relative_mouse()
            raise
        self._relative_mouse_active = enable_relative
        operation_id = snapshot.operation_id
        if operation_id is None:
            raise RuntimeError("Operation service did not create an operation id")
        self._normalizer = ActionNormalizer(config)
        self._paused = False
        self._started_ns = self._now_ns()
        self._paused_ns = 0
        self._pause_started_ns = None
        self._pause_boundary_ns = None
        self._resume_boundary_ns = None
        self._published_count = 0
        self._subscriber = self._bridge.subscribe()
        self._task = asyncio.create_task(self._run(operation_id), name=f"recording-{operation_id}")
        return OperationTransition(
            operation_id=operation_id, state=snapshot.state, snapshot=snapshot
        )

    async def pause(self, operation_id: UUID) -> OperationTransition:
        self._operations.require_operation(operation_id)
        now = self._now_ns()
        self._pause_boundary_ns = now
        subscriber = self._subscriber
        if subscriber is None:
            raise RuntimeError("Recording subscriber is missing")
        await self._bridge.synchronize(subscriber)
        self._pause_started_ns = now
        snapshot = await self._operations.transition(EngineState.PAUSED, operation_id)
        return OperationTransition(
            operation_id=operation_id, state=snapshot.state, snapshot=snapshot
        )

    async def resume(self, operation_id: UUID) -> OperationTransition:
        self._operations.require_operation(operation_id)
        now = self._now_ns()
        self._settle_pause(now)
        self._resume_boundary_ns = now
        subscriber = self._subscriber
        if subscriber is None:
            raise RuntimeError("Recording subscriber is missing")
        await self._bridge.synchronize(subscriber)
        snapshot = await self._operations.resume(operation_id)
        return OperationTransition(
            operation_id=operation_id, state=snapshot.state, snapshot=snapshot
        )

    async def stop(self, operation_id: UUID) -> RecordingStopResponse:
        async with self._stop_lock:
            return await self._stop(operation_id)

    async def _stop(self, operation_id: UUID) -> RecordingStopResponse:
        existing = self._stopped.get(operation_id)
        if existing is not None:
            return existing
        completed_result_id = self._result_by_operation.get(operation_id)
        if completed_result_id is not None and self._operations.operation_id is None:
            snapshot = self._operations.snapshot()
            response = RecordingStopResponse(
                operation_id=operation_id,
                state=snapshot.state,
                snapshot=snapshot,
                recording_result_id=completed_result_id,
            )
            self._stopped[operation_id] = response
            return response
        self._operations.require_operation(operation_id)
        self._settle_pause(self._now_ns())
        if self._operations.state != EngineState.STOPPING:
            await self._operations.transition(EngineState.STOPPING, operation_id)
        subscriber = self._subscriber
        if subscriber is not None:
            try:
                await self._bridge.drain_and_unsubscribe(subscriber)
            except Exception as exc:
                self._bridge.unsubscribe(subscriber, drain=True)
                with suppress(Exception):
                    await self._operations.fail(operation_id, exc)
        await self._wait_for_task()
        result_id = self._result_by_operation[operation_id]
        snapshot = self._operations.snapshot()
        response = RecordingStopResponse(
            operation_id=operation_id,
            state=snapshot.state,
            snapshot=snapshot,
            recording_result_id=result_id,
        )
        self._stopped[operation_id] = response
        return response

    def has_stopped(self, operation_id: UUID) -> bool:
        return operation_id in self._stopped

    async def get(self, result_id: UUID) -> RecordingResult:
        try:
            return self._results[result_id]
        except KeyError as exc:
            raise AppError(
                ErrorCode.SCRIPT_NOT_FOUND,
                "未找到录制结果",
                status_code=404,
            ) from exc

    async def result_for_operation(self, operation_id: UUID) -> RecordingResult | None:
        result_id = self._result_by_operation.get(operation_id)
        return self._results.get(result_id) if result_id is not None else None

    async def shutdown(self) -> None:
        operation_id = self._operations.operation_id
        if (
            operation_id is not None
            and self._operations.snapshot().operation_type == OperationType.RECORDING
        ):
            await self.stop(operation_id)

    async def _run(self, operation_id: UUID) -> None:
        subscriber = self._subscriber
        if subscriber is None:
            raise RuntimeError("Recording subscriber is missing")
        try:
            while True:
                event = await subscriber.get()
                if event is None:
                    break
                if isinstance(event, SubscriptionBarrier):
                    await self._apply_pause_boundary(operation_id, event)
                    continue
                normalizer = self._require_normalizer()
                if self._paused:
                    normalizer.observe_paused(event)
                    continue
                for action in normalizer.process(event):
                    await self._captured(operation_id, action)
        except Exception as exc:
            with suppress(Exception):
                await self._operations.fail(operation_id, exc)
        finally:
            self._bridge.unsubscribe(subscriber, drain=True)
            self._subscriber = None
            if self._relative_mouse_active:
                self._relative_mouse_active = False
                await self._disable_relative_mouse()
            await self._finalize(operation_id)

    async def _enable_relative_mouse(self) -> None:
        try:
            await asyncio.to_thread(self._bridge.set_relative_mouse, True)
        except Exception as exc:
            with suppress(Exception):
                await asyncio.to_thread(self._bridge.set_relative_mouse, False)
            raise AppError(
                ErrorCode.ENGINE_INTERNAL_ERROR,
                RELATIVE_MOUSE_UNAVAILABLE_MESSAGE,
                status_code=500,
                details={"exceptionType": type(exc).__name__, "reason": str(exc)},
                retryable=True,
            ) from exc

    async def _disable_relative_mouse(self) -> None:
        with suppress(Exception):
            await asyncio.to_thread(self._bridge.set_relative_mouse, False)

    async def _apply_pause_boundary(
        self,
        operation_id: UUID,
        barrier: SubscriptionBarrier,
    ) -> None:
        boundary = self._pause_boundary_ns
        normalizer = self._require_normalizer()
        if boundary is not None:
            for action in normalizer.pause(boundary):
                await self._captured(operation_id, action)
            self._paused = True
            self._pause_boundary_ns = None
        resume_boundary = self._resume_boundary_ns
        if resume_boundary is not None:
            for action in normalizer.resume(resume_boundary):
                await self._captured(operation_id, action)
            self._paused = False
            self._resume_boundary_ns = None
        if not barrier.reached.done():
            barrier.reached.set_result(None)

    async def _finalize(self, operation_id: UUID) -> None:
        normalizer = self._normalizer
        now = self._now_ns()
        if normalizer is not None:
            with suppress(Exception):
                for action in normalizer.finish(now):
                    await self._captured(operation_id, action)
            result_id = uuid4()
            result = RecordingResult(
                id=result_id,
                operation_id=operation_id,
                duration_ms=max(0, (now - self._started_ns - self._paused_ns) // 1_000_000),
                action_count=len(normalizer.actions),
                actions=normalizer.actions,
            )
            self._results[result_id] = result
            self._result_by_operation[operation_id] = result_id
            with suppress(Exception):
                await self._events.create(
                    "recording.snapshot",
                    result.model_dump(mode="json", by_alias=True),
                    operation_id,
                )
        await self._finish_state(operation_id)

    async def _captured(self, operation_id: UUID, action: ScriptAction) -> None:
        self._published_count += 1
        count = self._published_count
        with suppress(Exception):
            await self._events.create(
                "recording.action_captured",
                {
                    "action": action.model_dump(mode="json", by_alias=True),
                    "actionCount": count,
                },
                operation_id,
            )
        snapshot = self._operations.snapshot()
        with suppress(Exception):
            await self._operations.update_progress(
                elapsed_ms=snapshot.elapsed_ms + action.delay_before_ms,
                completed_count=count,
                progress=None,
                operation_id=operation_id,
            )

    async def _finish_state(self, operation_id: UUID) -> None:
        if self._operations.operation_id != operation_id:
            return
        if self._operations.state != EngineState.STOPPING:
            with suppress(Exception):
                await self._operations.transition(EngineState.STOPPING, operation_id)
        if self._operations.state == EngineState.STOPPING:
            with suppress(Exception):
                await self._operations.transition(EngineState.IDLE, operation_id)

    def _settle_pause(self, now_ns: int) -> None:
        if self._pause_started_ns is None:
            return
        paused_ns = max(0, now_ns - self._pause_started_ns)
        self._paused_ns += paused_ns
        if self._normalizer is not None:
            self._normalizer.shift_timeline(paused_ns)
        self._pause_started_ns = None

    def _require_normalizer(self) -> ActionNormalizer:
        if self._normalizer is None:
            raise RuntimeError("Recording normalizer is missing")
        return self._normalizer

    def _now_ns(self) -> int:
        return int(asyncio.get_running_loop().time() * 1_000_000_000)

    async def _wait_for_task(self) -> None:
        if self._task is not None:
            await self._task
            self._task = None
