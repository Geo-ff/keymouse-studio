from collections.abc import Callable
from pathlib import Path
from uuid import UUID

import pytest

from keymouse_studio.api.schemas.actions import ScriptAction
from keymouse_studio.api.schemas.events import EventEnvelope
from keymouse_studio.api.schemas.operations import EventPayload
from keymouse_studio.api.schemas.recording import RecordingConfig
from keymouse_studio.config import Settings
from keymouse_studio.domain.enums import EngineState
from keymouse_studio.infrastructure.input.adapter import FakeInputAdapter
from keymouse_studio.infrastructure.input.listener import (
    FakeInputListener,
    InputEventBridge,
    RawInputEvent,
)
from keymouse_studio.main import create_app
from keymouse_studio.services.action_normalizer import ActionNormalizer
from keymouse_studio.services.event_service import EventService
from keymouse_studio.services.operation_service import OperationService
from keymouse_studio.services.recording_service import RecordingService


class FinishFailingNormalizer(ActionNormalizer):
    def finish(self, monotonic_ns: int) -> list[ScriptAction]:
        raise RuntimeError("finish failed")


class FailingEventService(EventService):
    async def create(
        self,
        event_type: str,
        payload: EventPayload,
        operation_id: UUID | None = None,
    ) -> EventEnvelope:
        raise RuntimeError("event failed")


class StartFailingListener:
    def start(self, emit: Callable[[RawInputEvent], None]) -> None:
        raise RuntimeError("listener failed")

    def stop(self) -> None:
        pass


@pytest.mark.asyncio
async def test_recording_cleanup_survives_finish_and_event_failures() -> None:
    listener = FakeInputListener()
    bridge = InputEventBridge(listener)
    events = FailingEventService(1)
    operations = OperationService(events)
    service = RecordingService(operations, events, bridge)
    await bridge.start()
    transition = await service.start(RecordingConfig(record_mouse_move=False))
    service._normalizer = FinishFailingNormalizer(RecordingConfig(record_mouse_move=False))

    stopped = await service.stop(transition.operation_id)
    result = await service.get(stopped.recording_result_id)

    assert result.action_count == 0
    assert operations.state == EngineState.IDLE
    await bridge.stop()


@pytest.mark.asyncio
async def test_lifespan_rolls_back_partial_listener_start(tmp_path: Path) -> None:
    app = create_app(
        Settings(session_token="test-token", script_directory=tmp_path / "scripts"),
        FakeInputAdapter(),
        StartFailingListener(),
    )

    with pytest.raises(RuntimeError, match="listener failed"):
        async with app.router.lifespan_context(app):
            pass

    with pytest.raises(RuntimeError, match="closed"):
        await app.state.input_worker.move(1, 1)
