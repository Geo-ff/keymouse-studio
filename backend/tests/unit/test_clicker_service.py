import asyncio

import pytest
from pydantic import ValidationError

from keymouse_studio.api.schemas.clicker import ClickerConfig, TimedClickConfig
from keymouse_studio.domain.enums import EngineState, LoopMode, MouseButton, PositionMode
from keymouse_studio.domain.errors import ErrorCode
from keymouse_studio.infrastructure.input.adapter import FakeInputAdapter, InputWorker
from keymouse_studio.infrastructure.system.clock import MonotonicClock
from keymouse_studio.infrastructure.system.privilege import (
    FakePrivilegeChecker,
    IntegrityLevel,
    PrivilegeCheckResult,
)
from keymouse_studio.services.clicker_service import ClickerService
from keymouse_studio.services.event_service import EventService
from keymouse_studio.services.operation_service import OperationService


async def wait_until_idle(service: ClickerService, operations: OperationService) -> None:
    await asyncio.wait_for(service.wait_finished(), timeout=1)
    assert operations.state == EngineState.IDLE


def create_service(
    privilege: PrivilegeCheckResult | None = None,
    progress_publish_interval_ms: int = 5,
) -> tuple[ClickerService, OperationService, FakeInputAdapter, EventService]:
    adapter = FakeInputAdapter()
    events = EventService(protocol_version=1)
    operations = OperationService(events)
    checker = (
        FakePrivilegeChecker(privilege)
        if privilege is not None
        else FakePrivilegeChecker(
            PrivilegeCheckResult(
                process_integrity=IntegrityLevel.MEDIUM,
                foreground_integrity=IntegrityLevel.MEDIUM,
                can_inject=True,
            )
        )
    )
    service = ClickerService(
        operations,
        InputWorker(adapter),
        MonotonicClock(),
        5,
        privilege_checker=checker,
        progress_publish_interval_ms=progress_publish_interval_ms,
    )
    return service, operations, adapter, events


@pytest.mark.asyncio
async def test_fixed_count_executes_requested_clicks_and_position() -> None:
    service, operations, adapter, _events = create_service()
    await service.start_clicker(
        ClickerConfig(
            button=MouseButton.RIGHT,
            click_count=2,
            interval_ms=50,
            repeat_count=3,
            position_mode=PositionMode.FIXED,
            x=-20,
            y=40,
        )
    )
    await wait_until_idle(service, operations)

    assert adapter.actions.count(("move", (-20, 40))) == 3
    assert adapter.actions.count(("down", MouseButton.RIGHT)) == 6
    assert adapter.actions.count(("up", MouseButton.RIGHT)) == 6
    await service.shutdown()


@pytest.mark.asyncio
async def test_infinite_clicker_stops_and_releases_input() -> None:
    service, operations, adapter, _events = create_service()
    transition = await service.start_clicker(
        ClickerConfig(repeat_mode=LoopMode.INFINITE, interval_ms=50)
    )
    await asyncio.wait_for(asyncio.to_thread(adapter.action_recorded.wait), timeout=1)

    stopped = await service.stop(transition.operation_id)
    stopped_again = await service.stop(transition.operation_id)

    assert stopped.state == EngineState.IDLE
    assert stopped_again.state == EngineState.IDLE
    assert operations.state == EngineState.IDLE
    assert adapter.pressed == set()
    await service.shutdown()


@pytest.mark.asyncio
async def test_pause_freezes_timed_click_remaining_wait() -> None:
    service, operations, adapter, _events = create_service()
    transition = await service.start_timed_click(
        TimedClickConfig(delay_ms=80, interval_ms=50, repeat_count=1)
    )
    await asyncio.sleep(0.015)
    paused = await service.pause(transition.operation_id)
    await asyncio.sleep(0.09)

    assert paused.state == EngineState.PAUSED
    assert adapter.actions == []

    await service.resume(transition.operation_id)
    await wait_until_idle(service, operations)
    assert adapter.actions.count(("down", MouseButton.LEFT)) == 1
    await service.shutdown()


@pytest.mark.asyncio
async def test_emergency_stop_releases_registered_button() -> None:
    service, _operations, adapter, _events = create_service()
    adapter.button_down(MouseButton.MIDDLE)

    result = await service.emergency_stop()

    assert result.state == EngineState.IDLE
    assert result.released_input_count == 1
    assert adapter.pressed == set()
    await service.shutdown()


@pytest.mark.asyncio
async def test_progress_events_embed_sequence_and_completed_count() -> None:
    service, operations, _adapter, events = create_service(progress_publish_interval_ms=0)
    queue = events.subscribe()
    await service.start_clicker(
        ClickerConfig(interval_ms=50, repeat_count=2, countdown_ms=0)
    )
    await wait_until_idle(service, operations)

    progress_events = []
    while not queue.empty():
        event = queue.get_nowait()
        if event.type == "operation.progress":
            progress_events.append(event)
    assert progress_events
    for event in progress_events:
        payload = event.payload
        assert hasattr(payload, "sequence")
        assert payload.sequence == event.sequence  # type: ignore[union-attr]
        assert payload.completed_count >= 0  # type: ignore[union-attr]
    assert any(event.payload.completed_count >= 1 for event in progress_events)  # type: ignore[union-attr]
    await service.shutdown()
    events.unsubscribe(queue)


@pytest.mark.asyncio
async def test_elevated_foreground_auto_pauses_and_raises_permission_error() -> None:
    blocked = PrivilegeCheckResult(
        process_integrity=IntegrityLevel.MEDIUM,
        foreground_integrity=IntegrityLevel.HIGH,
        can_inject=False,
    )
    service, operations, adapter, events = create_service(privilege=blocked)
    queue = events.subscribe()
    transition = await service.start_clicker(
        ClickerConfig(interval_ms=50, repeat_mode=LoopMode.INFINITE, countdown_ms=0)
    )
    await asyncio.sleep(0.05)
    assert operations.state == EngineState.PAUSED
    assert adapter.actions == []

    permission_events = []
    while not queue.empty():
        event = queue.get_nowait()
        if event.type == "error.raised":
            permission_events.append(event)
    assert permission_events
    assert permission_events[0].payload["code"] == ErrorCode.INPUT_PERMISSION_DENIED

    await service.stop(transition.operation_id)
    await service.shutdown()
    events.unsubscribe(queue)


@pytest.mark.parametrize(
    "values",
    [
        {"intervalMs": 0},
        {"clickCount": 3},
        {"repeatMode": "infinite", "repeatCount": 2},
        {"positionMode": "fixed", "x": 1},
        {"positionMode": "current", "x": 1, "y": 2},
        {"countdownMs": 86_400_001},
    ],
)
def test_clicker_config_rejects_boundary_violations(values: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        ClickerConfig.model_validate(values)
