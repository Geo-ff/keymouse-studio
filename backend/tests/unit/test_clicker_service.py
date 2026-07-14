import asyncio

import pytest
from pydantic import ValidationError

from keymouse_studio.api.schemas.clicker import ClickerConfig, TimedClickConfig
from keymouse_studio.domain.enums import EngineState, LoopMode, MouseButton, PositionMode
from keymouse_studio.infrastructure.input.adapter import FakeInputAdapter, InputWorker
from keymouse_studio.infrastructure.system.clock import MonotonicClock
from keymouse_studio.services.clicker_service import ClickerService
from keymouse_studio.services.event_service import EventService
from keymouse_studio.services.operation_service import OperationService


async def wait_until_idle(service: ClickerService, operations: OperationService) -> None:
    await asyncio.wait_for(service.wait_finished(), timeout=1)
    assert operations.state == EngineState.IDLE


def create_service() -> tuple[ClickerService, OperationService, FakeInputAdapter]:
    adapter = FakeInputAdapter()
    operations = OperationService(EventService(protocol_version=1))
    service = ClickerService(operations, InputWorker(adapter), MonotonicClock(), 5)
    return service, operations, adapter


@pytest.mark.asyncio
async def test_fixed_count_executes_requested_clicks_and_position() -> None:
    service, operations, adapter = create_service()
    await service.start_clicker(
        ClickerConfig(
            button=MouseButton.RIGHT,
            click_count=2,
            interval_ms=1,
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
    service, operations, adapter = create_service()
    transition = await service.start_clicker(
        ClickerConfig(repeat_mode=LoopMode.INFINITE, interval_ms=1)
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
    service, operations, adapter = create_service()
    transition = await service.start_timed_click(
        TimedClickConfig(delay_ms=80, interval_ms=1, repeat_count=1)
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
    service, _operations, adapter = create_service()
    adapter.button_down(MouseButton.MIDDLE)

    result = await service.emergency_stop()

    assert result.state == EngineState.IDLE
    assert result.released_input_count == 1
    assert adapter.pressed == set()
    await service.shutdown()


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
