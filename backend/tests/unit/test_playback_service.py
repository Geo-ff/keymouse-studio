import asyncio
from pathlib import Path

import pytest

from keymouse_studio.api.schemas.operations import StateSnapshot
from keymouse_studio.api.schemas.playback import PlaybackRequest
from keymouse_studio.api.schemas.scripts import Script
from keymouse_studio.domain.enums import EngineState, LoopMode, MouseButton
from keymouse_studio.domain.errors import AppError
from keymouse_studio.infrastructure.input.adapter import (
    FakeInputAdapter,
    InputWorker,
    ReleaseResult,
)
from keymouse_studio.infrastructure.persistence.json_script_repository import JsonScriptRepository
from keymouse_studio.infrastructure.system.clock import MonotonicClock
from keymouse_studio.services.event_service import EventService
from keymouse_studio.services.operation_service import OperationService
from keymouse_studio.services.playback_service import PlaybackService
from keymouse_studio.services.script_service import ScriptService


class FailingInputAdapter(FakeInputAdapter):
    def wheel(self, delta_x: int, delta_y: int) -> None:
        raise OSError("wheel failed")


class ReleaseFailingInputAdapter(FakeInputAdapter):
    def release_all(self) -> ReleaseResult:
        raise OSError("release failed")


def inline_script() -> Script:
    return Script.model_validate(
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "name": "Playback",
            "createdAt": "2026-07-14T00:00:00Z",
            "updatedAt": "2026-07-14T00:00:00Z",
            "settings": {"countdownMs": 0},
            "actions": [
                {
                    "id": "00000000-0000-0000-0000-000000000002",
                    "type": "key_down",
                    "payload": {"keyCode": "a", "scanCode": 30},
                },
                {
                    "id": "00000000-0000-0000-0000-000000000003",
                    "type": "mouse_wheel",
                    "delayBeforeMs": 1,
                    "payload": {"deltaX": 0, "deltaY": -1},
                },
                {
                    "id": "00000000-0000-0000-0000-000000000004",
                    "type": "key_up",
                    "payload": {"keyCode": "a", "scanCode": 30},
                },
            ],
        }
    )


@pytest.mark.asyncio
async def test_playback_executes_keyboard_wheel_and_progress(tmp_path: Path) -> None:
    adapter = FakeInputAdapter()
    worker = InputWorker(adapter)
    operations = OperationService(EventService(1))
    scripts = ScriptService(JsonScriptRepository(tmp_path / "scripts"))
    service = PlaybackService(operations, scripts, worker, MonotonicClock(), 2)

    transition = await service.start(PlaybackRequest(inline_script=inline_script(), countdown_ms=0))
    await asyncio.wait_for(service.wait_finished(), timeout=1)

    assert transition.state == EngineState.RUNNING
    assert ("key_down", ("a", 30, False)) in adapter.actions
    assert ("wheel", (0, -1)) in adapter.actions
    assert ("key_up", ("a", 30, False)) in adapter.actions
    assert adapter.pressed_keys == set()
    assert operations.state == EngineState.IDLE
    worker.close()


@pytest.mark.asyncio
async def test_worker_release_all_releases_keyboard_and_mouse() -> None:
    adapter = FakeInputAdapter()
    worker = InputWorker(adapter)
    await worker.button_down(MouseButton.LEFT)
    await worker.key_down("a", 30, False)

    result = await worker.release_all()

    assert result.released_count == 2
    assert adapter.pressed == set()
    assert adapter.pressed_keys == set()
    worker.close()


@pytest.mark.asyncio
async def test_playback_pause_preserves_remaining_wait(tmp_path: Path) -> None:
    adapter = FakeInputAdapter()
    worker = InputWorker(adapter)
    operations = OperationService(EventService(1))
    scripts = ScriptService(JsonScriptRepository(tmp_path / "scripts"))
    service = PlaybackService(operations, scripts, worker, MonotonicClock(), 2)
    script = inline_script().model_copy(
        update={"actions": [inline_script().actions[1].model_copy(update={"delay_before_ms": 80})]}
    )

    transition = await service.start(PlaybackRequest(inline_script=script, countdown_ms=0))
    await asyncio.sleep(0.01)
    await service.pause(transition.operation_id)
    await asyncio.sleep(0.09)

    assert adapter.actions == []
    assert operations.state == EngineState.PAUSED
    await service.resume(transition.operation_id)
    await asyncio.wait_for(service.wait_finished(), timeout=1)
    assert adapter.actions == [("wheel", (0, -1))]
    worker.close()


@pytest.mark.asyncio
async def test_playback_failure_releases_pressed_input_and_publishes_error(
    tmp_path: Path,
) -> None:
    adapter = FailingInputAdapter()
    worker = InputWorker(adapter)
    events = EventService(1)
    subscriber = events.subscribe()
    operations = OperationService(events)
    scripts = ScriptService(JsonScriptRepository(tmp_path / "scripts"))
    service = PlaybackService(operations, scripts, worker, MonotonicClock(), 2)

    await service.start(PlaybackRequest(inline_script=inline_script(), countdown_ms=0))
    await asyncio.wait_for(service.wait_finished(), timeout=1)
    event_types = []
    while not subscriber.empty():
        event_types.append(subscriber.get_nowait().type)

    assert "error.raised" in event_types
    assert adapter.pressed_keys == set()
    assert operations.state == EngineState.IDLE
    worker.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("case", ["empty", "disabled", "zero_wait"])
async def test_playback_rejects_scripts_without_enabled_actions(
    tmp_path: Path,
    case: str,
) -> None:
    script = inline_script().model_copy(update={"actions": []})
    if case == "disabled":
        script = inline_script().model_copy(
            update={"actions": [inline_script().actions[0].model_copy(update={"enabled": False})]}
        )
    elif case == "zero_wait":
        data = inline_script().model_dump(mode="json", by_alias=True)
        data["actions"] = [
            {
                "id": "00000000-0000-0000-0000-000000000011",
                "type": "wait",
                "payload": {"durationMs": 0},
            }
        ]
        script = Script.model_validate(data)
    worker = InputWorker(FakeInputAdapter())
    operations = OperationService(EventService(1))
    service = PlaybackService(
        operations,
        ScriptService(JsonScriptRepository(tmp_path / "scripts")),
        worker,
        MonotonicClock(),
        2,
    )

    with pytest.raises(AppError) as exc_info:
        await service.start(
            PlaybackRequest(
                inline_script=script,
                loop_mode=LoopMode.INFINITE,
                countdown_ms=0,
            )
        )

    assert exc_info.value.status_code == 422
    assert operations.state == EngineState.IDLE
    worker.close()


@pytest.mark.asyncio
async def test_loop_duration_excludes_countdown_and_publishes_final_progress(
    tmp_path: Path,
) -> None:
    worker = InputWorker(FakeInputAdapter())
    events = EventService(1)
    subscriber = events.subscribe()
    operations = OperationService(events)
    service = PlaybackService(
        operations,
        ScriptService(JsonScriptRepository(tmp_path / "scripts")),
        worker,
        MonotonicClock(),
        2,
    )
    data = inline_script().model_dump(mode="json", by_alias=True)
    data["actions"] = [
        {
            "id": "00000000-0000-0000-0000-000000000010",
            "type": "wait",
            "payload": {"durationMs": 1000},
        }
    ]
    script = Script.model_validate(data)
    before = asyncio.get_running_loop().time()

    await service.start(
        PlaybackRequest(
            inline_script=script,
            loop_mode=LoopMode.INFINITE,
            loop_duration_ms=30,
            countdown_ms=20,
        )
    )
    await asyncio.wait_for(service.wait_finished(), timeout=1)
    wall_ms = (asyncio.get_running_loop().time() - before) * 1000
    snapshots = []
    while not subscriber.empty():
        event = subscriber.get_nowait()
        if event.type == "operation.progress":
            snapshots.append(event.payload)
    final = snapshots[-1]
    assert isinstance(final, StateSnapshot)

    assert wall_ms >= 45
    assert final.progress == 1.0
    assert final.completed_count == 0
    assert final.current_action_index is None
    assert 25 <= final.elapsed_ms <= 80
    worker.close()


@pytest.mark.asyncio
async def test_count_playback_final_progress_tracks_completed_loops(tmp_path: Path) -> None:
    worker = InputWorker(FakeInputAdapter())
    events = EventService(1)
    subscriber = events.subscribe()
    operations = OperationService(events)
    service = PlaybackService(
        operations,
        ScriptService(JsonScriptRepository(tmp_path / "scripts")),
        worker,
        MonotonicClock(),
        2,
    )

    await service.start(
        PlaybackRequest(
            inline_script=inline_script(),
            loop_mode=LoopMode.COUNT,
            loop_count=2,
            countdown_ms=0,
        )
    )
    await service.wait_finished()
    snapshots = []
    while not subscriber.empty():
        event = subscriber.get_nowait()
        if event.type == "operation.progress":
            snapshots.append(event.payload)
    final = snapshots[-1]
    assert isinstance(final, StateSnapshot)

    assert final.completed_count == 2
    assert final.progress == 1.0
    assert final.current_action_index == 2
    worker.close()


@pytest.mark.asyncio
async def test_release_failure_does_not_block_playback_state_cleanup(tmp_path: Path) -> None:
    worker = InputWorker(ReleaseFailingInputAdapter())
    operations = OperationService(EventService(1))
    service = PlaybackService(
        operations,
        ScriptService(JsonScriptRepository(tmp_path / "scripts")),
        worker,
        MonotonicClock(),
        2,
    )

    transition = await service.start(PlaybackRequest(inline_script=inline_script(), countdown_ms=0))
    await service.wait_finished()
    release = service.release_result(transition.operation_id)

    assert release.failures == ("release_all:OSError",)
    assert operations.state == EngineState.IDLE
    worker.close()


@pytest.mark.asyncio
async def test_long_wait_publishes_smooth_progress_before_completion(
    tmp_path: Path,
) -> None:
    worker = InputWorker(FakeInputAdapter())
    events = EventService(1)
    subscriber = events.subscribe()
    operations = OperationService(events)
    service = PlaybackService(
        operations,
        ScriptService(JsonScriptRepository(tmp_path / "scripts")),
        worker,
        MonotonicClock(),
        5,
    )
    data = inline_script().model_dump(mode="json", by_alias=True)
    data["actions"] = [
        {
            "id": "00000000-0000-0000-0000-000000000012",
            "type": "wait",
            "payload": {"durationMs": 500},
        }
    ]

    await service.start(
        PlaybackRequest(
            inline_script=Script.model_validate(data),
            loop_mode=LoopMode.COUNT,
            loop_count=1,
            countdown_ms=0,
        )
    )
    await asyncio.wait_for(service.wait_finished(), timeout=1)

    progress_values = []
    while not subscriber.empty():
        event = subscriber.get_nowait()
        if event.type == "operation.progress" and event.payload.progress is not None:
            progress_values.append(event.payload.progress)
    intermediate = [value for value in progress_values if 0 < value < 1]
    assert intermediate
    assert intermediate == sorted(intermediate)
    assert progress_values[-1] == 1.0
    worker.close()
