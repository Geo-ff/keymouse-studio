from __future__ import annotations

import asyncio
from contextlib import suppress
from typing import Protocol
from uuid import UUID

from keymouse_studio.api.schemas.actions import KeyPayload
from keymouse_studio.api.schemas.clicker import (
    ClickerConfig,
    EmergencyStopResponse,
    TimedClickConfig,
)
from keymouse_studio.api.schemas.operations import OperationTransition
from keymouse_studio.api.schemas.settings import ApplicationSettings, normalize_hotkey
from keymouse_studio.domain.enums import (
    ClickerInputType,
    EngineState,
    LoopMode,
    OperationType,
    PositionMode,
)
from keymouse_studio.domain.errors import AppError, ErrorCode
from keymouse_studio.infrastructure.input.adapter import InputWorker, ReleaseResult
from keymouse_studio.infrastructure.input.key_codes import (
    is_modifier_key,
    keys_to_hotkey_chord,
    normalize_key_code,
)
from keymouse_studio.infrastructure.system.clock import Clock
from keymouse_studio.infrastructure.system.privilege import (
    AlwaysAllowPrivilegeChecker,
    PrivilegeChecker,
)
from keymouse_studio.services.operation_service import OperationService


class SettingsProvider(Protocol):
    async def get(self) -> ApplicationSettings: ...

PRIVILEGE_BLOCK_MESSAGE = (
    "当前前台窗口权限高于本应用, 系统禁止注入键鼠输入。"
    "任务已自动暂停。请将目标程序改为普通权限运行, "
    "或将 KeyMouse Studio 以管理员身份启动后再继续。"
)

CONTROL_HOTKEY_LABELS = {
    "emergency_stop_hotkey": "急停热键",
    "record_start_hotkey": "开始录制",
    "record_stop_hotkey": "停止录制",
    "playback_start_hotkey": "开始回放",
    "playback_stop_hotkey": "停止回放",
}


class ClickerService:
    def __init__(
        self,
        operations: OperationService,
        input_worker: InputWorker,
        clock: Clock,
        poll_interval_ms: int = 25,
        privilege_checker: PrivilegeChecker | None = None,
        progress_publish_interval_ms: int = 100,
        settings_service: SettingsProvider | None = None,
    ) -> None:
        self._operations = operations
        self._input = input_worker
        self._clock = clock
        self._poll_seconds = poll_interval_ms / 1000
        self._privilege = privilege_checker or AlwaysAllowPrivilegeChecker()
        self._progress_publish_ns = max(0, progress_publish_interval_ms) * 1_000_000
        self._settings_service = settings_service
        self._cancelled = asyncio.Event()
        self._running = asyncio.Event()
        self._running.set()
        self._cycle_active = asyncio.Event()
        self._task: asyncio.Task[None] | None = None
        self._last_operation_id: UUID | None = None
        self._elapsed_ns = 0
        self._release_results: dict[UUID, ReleaseResult] = {}
        self._last_progress_publish_ns = 0

    async def start_clicker(self, config: ClickerConfig) -> OperationTransition:
        await self._reject_control_hotkey_conflict(config)
        return await self._start(OperationType.CLICKER, config, 0)

    async def start_timed_click(self, config: TimedClickConfig) -> OperationTransition:
        if config.input_type == ClickerInputType.KEYBOARD:
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                "定时点击仅支持鼠标模式",
                status_code=422,
            )
        return await self._start(OperationType.TIMED_CLICK, config, config.delay_ms)

    async def pause(self, operation_id: UUID) -> OperationTransition:
        self._operations.require_operation(operation_id)
        self._running.clear()
        if self._cycle_active.is_set():
            with suppress(TimeoutError, asyncio.TimeoutError):
                await asyncio.wait_for(self._wait_cycle_idle(), timeout=2)
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
                "当前已有任务在运行, 请先停止后再开始",
                status_code=409,
            )
        startup_wait_ms = config.countdown_ms
        initial_state = EngineState.COUNTDOWN if startup_wait_ms else EngineState.RUNNING
        snapshot = await self._operations.start(
            operation_type,
            initial_state,
            countdown_remaining_ms=startup_wait_ms,
        )
        operation_id = snapshot.operation_id
        if operation_id is None:
            raise RuntimeError("Operation service did not create an operation id")
        self._cancelled = asyncio.Event()
        self._running = asyncio.Event()
        self._running.set()
        self._cycle_active = asyncio.Event()
        self._last_operation_id = operation_id
        self._elapsed_ns = 0
        self._task = asyncio.create_task(
            self._run(operation_id, config, startup_wait_ms, delay_ms),
            name=f"{operation_type}-{operation_id}",
        )
        return OperationTransition(
            operation_id=operation_id, state=snapshot.state, snapshot=snapshot
        )

    async def _run(
        self,
        operation_id: UUID,
        config: ClickerConfig,
        startup_wait_ms: int,
        delay_ms: int,
    ) -> None:
        completed = 0
        total = config.repeat_count if config.repeat_mode == LoopMode.COUNT else None
        try:
            if startup_wait_ms:
                await self._wait(startup_wait_ms, completed, total, publish_remaining=True)
                self._raise_if_cancelled()
                await self._publish_progress(completed, None, force=True)
                await self._operations.transition(EngineState.RUNNING, operation_id)
            if delay_ms:
                await self._wait(delay_ms, completed, total, publish_remaining=True)
                self._raise_if_cancelled()
                await self._publish_progress(
                    completed,
                    0.0 if total is not None else None,
                    force=True,
                )
            while total is None or completed < total:
                self._raise_if_cancelled()
                await self._running.wait()
                if config.input_type == ClickerInputType.KEYBOARD:
                    if not await self._ensure_injectable(operation_id, completed, total):
                        continue
                    await self._execute_keyboard_cycle(config)
                else:
                    target_x, target_y = await self._target_point(config)
                    if not await self._ensure_injectable(
                        operation_id, completed, total, target_x, target_y
                    ):
                        continue
                    if config.position_mode == PositionMode.FIXED:
                        if config.x is None or config.y is None:
                            raise RuntimeError("固定坐标模式下缺少 X/Y")
                        await self._input.move(config.x, config.y)
                    for _ in range(config.click_count):
                        await self._click(config, operation_id, completed, total)
                completed += 1
                progress = completed / total if total is not None else None
                await self._publish_progress(completed, progress, force=True)
                if total is None or completed < total:
                    await self._wait(
                        config.interval_ms,
                        completed,
                        total,
                        publish_remaining=delay_ms > 0,
                    )
        except asyncio.CancelledError:
            self._cancelled.set()
            raise
        except Exception as exc:
            await self._operations.fail(operation_id, exc)
        finally:
            self._cycle_active.clear()
            self._release_results[operation_id] = await self._safe_release()
            if self._operations.operation_id == operation_id:
                if self._operations.state != EngineState.STOPPING:
                    with suppress(AppError):
                        await self._operations.transition(EngineState.STOPPING, operation_id)
                if self._operations.state == EngineState.STOPPING:
                    await self._operations.transition(EngineState.IDLE, operation_id)

    async def _click(
        self,
        config: ClickerConfig,
        operation_id: UUID,
        completed: int,
        total: int | None,
    ) -> None:
        await self._running.wait()
        self._raise_if_cancelled()
        target_x, target_y = await self._target_point(config)
        if not await self._ensure_injectable(operation_id, completed, total, target_x, target_y):
            await self._running.wait()
            self._raise_if_cancelled()
        self._cycle_active.set()
        try:
            await self._input.button_down(config.button)
            try:
                self._raise_if_cancelled()
            finally:
                await self._input.button_up(config.button)
        finally:
            self._cycle_active.clear()

    async def _execute_keyboard_cycle(self, config: ClickerConfig) -> None:
        await self._running.wait()
        self._raise_if_cancelled()
        ordered = _ordered_keys(config.keys)
        pressed: list[KeyPayload] = []
        self._cycle_active.set()
        try:
            for key in ordered:
                self._raise_if_cancelled()
                if not self._running.is_set():
                    break
                await self._input.key_down(key.key_code, key.scan_code, key.extended)
                pressed.append(key)
            if pressed and self._running.is_set() and not self._cancelled.is_set():
                await self._wait_key_hold(config.press_duration_ms)
        finally:
            await self._release_keys(pressed)
            self._cycle_active.clear()

    async def _wait_key_hold(self, duration_ms: int) -> None:
        remaining_ns = duration_ms * 1_000_000
        while remaining_ns > 0:
            if self._cancelled.is_set() or not self._running.is_set():
                return
            slice_seconds = min(remaining_ns / 1_000_000_000, self._poll_seconds)
            before = self._clock.now_ns()
            await self._clock.sleep(slice_seconds)
            if self._cancelled.is_set() or not self._running.is_set():
                return
            elapsed = min(max(0, self._clock.now_ns() - before), remaining_ns)
            remaining_ns -= elapsed
            self._elapsed_ns += elapsed

    async def _release_keys(self, pressed: list[KeyPayload]) -> None:
        for key in reversed(pressed):
            with suppress(Exception):
                await self._input.key_up(key.key_code, key.scan_code, key.extended)

    async def _wait_cycle_idle(self) -> None:
        while self._cycle_active.is_set():
            await self._clock.sleep(self._poll_seconds)

    async def _target_point(self, config: ClickerConfig) -> tuple[int | None, int | None]:
        if config.position_mode == PositionMode.FIXED:
            return config.x, config.y
        try:
            x, y = await self._input.get_position()
            return x, y
        except Exception:
            return None, None

    async def _wait(
        self,
        duration_ms: int,
        completed: int,
        total: int | None,
        *,
        publish_remaining: bool = False,
    ) -> None:
        remaining_ns = duration_ms * 1_000_000
        progress = completed / total if total is not None else None
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
            if publish_remaining:
                await self._publish_progress(
                    completed,
                    None,
                    max(0, remaining_ns // 1_000_000),
                )
            else:
                await self._publish_progress(completed, progress)

    async def _ensure_injectable(
        self,
        operation_id: UUID,
        completed: int,
        total: int | None,
        x: int | None = None,
        y: int | None = None,
    ) -> bool:
        result = self._privilege.check(x=x, y=y)
        if result.can_inject:
            return True
        if self._operations.state == EngineState.PAUSED:
            return False
        progress = completed / total if total is not None else None
        await self._publish_progress(completed, progress, force=True)
        self._running.clear()
        await self._operations.transition(EngineState.PAUSED, operation_id)
        await self._operations.publish_error(
            code=ErrorCode.INPUT_PERMISSION_DENIED,
            message=PRIVILEGE_BLOCK_MESSAGE,
            details={
                "processIntegrity": result.process_integrity.value,
                "foregroundIntegrity": (
                    result.foreground_integrity.value if result.foreground_integrity else None
                ),
                "targetIntegrity": (
                    result.target_integrity.value if result.target_integrity else None
                ),
                "reason": result.reason or "target_integrity_higher",
            },
            retryable=True,
            operation_id=operation_id,
        )
        return False

    async def _publish_progress(
        self,
        completed: int,
        progress: float | None,
        countdown_remaining_ms: int = 0,
        *,
        force: bool = False,
    ) -> None:
        now = self._clock.now_ns()
        if (
            not force
            and self._progress_publish_ns > 0
            and now - self._last_progress_publish_ns < self._progress_publish_ns
        ):
            return
        self._last_progress_publish_ns = now
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

    async def _reject_control_hotkey_conflict(self, config: ClickerConfig) -> None:
        if config.input_type != ClickerInputType.KEYBOARD or not config.keys:
            return
        if self._settings_service is None:
            return
        settings = await self._settings_service.get()
        chord = keys_to_hotkey_chord([key.key_code for key in config.keys])
        try:
            normalized_chord = normalize_hotkey(chord)
        except ValueError:
            return
        reserved = {
            "emergency_stop_hotkey": settings.emergency_stop_hotkey,
            "record_start_hotkey": settings.record_start_hotkey,
            "record_stop_hotkey": settings.record_stop_hotkey,
            "playback_start_hotkey": settings.playback_start_hotkey,
            "playback_stop_hotkey": settings.playback_stop_hotkey,
        }
        for field, hotkey in reserved.items():
            if not hotkey:
                continue
            if normalize_hotkey(hotkey) == normalized_chord:
                label = CONTROL_HOTKEY_LABELS.get(field, field)
                raise AppError(
                    ErrorCode.VALIDATION_ERROR,
                    f"键盘连点组合不能与{label}相同",
                    status_code=422,
                    details={"conflictField": field, "hotkey": hotkey},
                )


def _ordered_keys(keys: list[KeyPayload]) -> list[KeyPayload]:
    modifiers = [key for key in keys if is_modifier_key(normalize_key_code(key.key_code))]
    primaries = [key for key in keys if not is_modifier_key(normalize_key_code(key.key_code))]
    return [*modifiers, *primaries]
