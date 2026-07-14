import asyncio

import pytest

from keymouse_studio.api.schemas.operations import StateSnapshot
from keymouse_studio.domain.enums import EngineState, OperationType
from keymouse_studio.domain.errors import AppError, ErrorCode
from keymouse_studio.domain.state_machine import OperationStateMachine
from keymouse_studio.services.event_service import EventService
from keymouse_studio.services.operation_service import OperationService


def test_state_machine_resumes_to_previous_state() -> None:
    machine = OperationStateMachine()
    machine.transition(EngineState.RECORDING)
    machine.transition(EngineState.PAUSED)
    assert machine.resume() == EngineState.RECORDING


def test_state_machine_rejects_invalid_transition() -> None:
    machine = OperationStateMachine()
    with pytest.raises(AppError) as exc_info:
        machine.transition(EngineState.PAUSED)
    assert exc_info.value.code == ErrorCode.INVALID_STATE_TRANSITION


@pytest.mark.asyncio
async def test_event_sequence_is_strictly_increasing() -> None:
    events = EventService(protocol_version=1)
    created = await asyncio.gather(*(events.create("test", {}) for _ in range(20)))
    assert sorted(event.sequence for event in created) == list(range(1, 21))
    assert len({event.event_id for event in created}) == 20


@pytest.mark.asyncio
async def test_operation_service_enforces_exclusive_operation() -> None:
    service = OperationService(EventService(protocol_version=1))
    started = await service.start(OperationType.RECORDING, EngineState.RECORDING)
    assert started.operation_id is not None
    assert started.sequence == 1
    with pytest.raises(AppError) as exc_info:
        await service.start(OperationType.PLAYBACK, EngineState.RUNNING)
    assert exc_info.value.code == ErrorCode.OPERATION_CONFLICT


@pytest.mark.asyncio
async def test_snapshot_event_uses_same_sequence_in_envelope_and_payload() -> None:
    service = OperationService(EventService(protocol_version=1))
    event = await service.snapshot_event()
    assert event.sequence == 1
    assert isinstance(event.payload, StateSnapshot)
    assert event.payload.sequence == event.sequence
