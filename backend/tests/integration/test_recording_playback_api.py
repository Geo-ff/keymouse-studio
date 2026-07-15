import asyncio
from pathlib import Path
from uuid import UUID

import httpx
import pytest

from keymouse_studio.config import Settings
from keymouse_studio.domain.enums import MouseButton
from keymouse_studio.infrastructure.input.adapter import FakeInputAdapter
from keymouse_studio.infrastructure.input.listener import FakeInputListener, RawInputEvent
from keymouse_studio.main import create_app
from tests.conftest import asgi_transport


@pytest.mark.asyncio
async def test_recording_api_captures_and_returns_actions(tmp_path: Path) -> None:
    adapter = FakeInputAdapter()
    listener = FakeInputListener()
    app = create_app(
        Settings(session_token="test-token", script_directory=tmp_path / "scripts"),
        adapter,
        listener,
    )
    headers = {"Authorization": "Bearer test-token"}
    event_queue = app.state.event_service.subscribe()
    async with app.router.lifespan_context(app):
        transport = asgi_transport(app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            started = await client.post(
                "/api/v1/recordings/start",
                headers=headers,
                json={"recordMouseMove": False},
            )
            operation_id = started.json()["operationId"]
            listener.emit(RawInputEvent("key_down", 1, key_code="a", scan_code=30))
            listener.emit(RawInputEvent("key_up", 2_000_001, key_code="a", scan_code=30))
            listener.emit(RawInputEvent("mouse_button_down", 3_000_001, button=MouseButton.LEFT))

            stopped = await client.post(
                f"/api/v1/operations/{operation_id}/stop",
                headers=headers,
            )
            result = await app.state.recording_service.result_for_operation(UUID(operation_id))
            assert result is not None
            fetched = await client.get(f"/api/v1/recordings/{result.id}", headers=headers)

    assert started.status_code == 202
    assert stopped.status_code == 200
    assert stopped.json()["recordingResultId"] == str(result.id)
    action_counts = []
    while not event_queue.empty():
        event = event_queue.get_nowait()
        if event.type == "recording.action_captured":
            action_counts.append(event.payload["actionCount"])
    assert action_counts == [1, 2, 3, 4]
    assert [action["type"] for action in fetched.json()["actions"]] == [
        "key_down",
        "key_up",
        "mouse_button_down",
        "mouse_button_up",
    ]


@pytest.mark.asyncio
async def test_f12_hotkey_emergency_stops_playback(tmp_path: Path) -> None:
    adapter = FakeInputAdapter()
    listener = FakeInputListener()
    app = create_app(
        Settings(session_token="test-token", script_directory=tmp_path / "scripts"),
        adapter,
        listener,
    )
    headers = {"Authorization": "Bearer test-token"}
    script = {
        "id": "00000000-0000-0000-0000-000000000001",
        "name": "Wait",
        "createdAt": "2026-07-14T00:00:00Z",
        "updatedAt": "2026-07-14T00:00:00Z",
        "settings": {"countdownMs": 0},
        "actions": [
            {
                "id": "00000000-0000-0000-0000-000000000002",
                "type": "wait",
                "payload": {"durationMs": 5000},
            }
        ],
    }
    async with app.router.lifespan_context(app):
        transport = asgi_transport(app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            started = await client.post(
                "/api/v1/playback/start",
                headers=headers,
                json={"inlineScript": script},
            )
            assert started.status_code == 202
            listener.emit(RawInputEvent("key_down", 1, key_code="f12"))
            await asyncio.wait_for(app.state.playback_service.wait_finished(), timeout=1)
            state = await client.get("/api/v1/state", headers=headers)

    assert state.json()["state"] == "idle"
    assert adapter.pressed == set()
    assert adapter.pressed_keys == set()


@pytest.mark.asyncio
async def test_recording_pause_stop_excludes_paused_time_and_is_idempotent(
    tmp_path: Path,
) -> None:
    listener = FakeInputListener()
    app = create_app(
        Settings(session_token="test-token", script_directory=tmp_path / "scripts"),
        FakeInputAdapter(),
        listener,
    )
    headers = {"Authorization": "Bearer test-token"}
    async with app.router.lifespan_context(app):
        transport = asgi_transport(app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            started = await client.post(
                "/api/v1/recordings/start",
                headers=headers,
                json={"recordMouseMove": False},
            )
            operation_id = started.json()["operationId"]
            paused = await client.post(
                f"/api/v1/operations/{operation_id}/pause",
                headers=headers,
            )
            await asyncio.sleep(0.05)
            stopped = await client.post(
                f"/api/v1/operations/{operation_id}/stop",
                headers=headers,
            )
            stopped_again = await client.post(
                f"/api/v1/operations/{operation_id}/stop",
                headers=headers,
            )
            result = await app.state.recording_service.result_for_operation(UUID(operation_id))

    assert paused.status_code == 200
    assert result is not None
    assert result.duration_ms < 40
    assert stopped.json() == stopped_again.json()


@pytest.mark.asyncio
async def test_recording_keeps_balanced_key_edges_across_pause(tmp_path: Path) -> None:
    listener = FakeInputListener()
    app = create_app(
        Settings(session_token="test-token", script_directory=tmp_path / "scripts"),
        FakeInputAdapter(),
        listener,
    )
    headers = {"Authorization": "Bearer test-token"}
    async with app.router.lifespan_context(app):
        transport = asgi_transport(app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            started = await client.post(
                "/api/v1/recordings/start",
                headers=headers,
                json={"recordMouseMove": False},
            )
            operation_id = started.json()["operationId"]
            listener.emit(RawInputEvent("key_down", 1, key_code="ctrl"))
            listener.emit(RawInputEvent("key_down", 2, key_code="c"))
            await client.post(f"/api/v1/operations/{operation_id}/pause", headers=headers)
            listener.emit(RawInputEvent("key_up", 3, key_code="c"))
            await client.post(f"/api/v1/operations/{operation_id}/resume", headers=headers)
            listener.emit(RawInputEvent("key_up", 4, key_code="ctrl"))
            await client.post(f"/api/v1/operations/{operation_id}/stop", headers=headers)
            result = await app.state.recording_service.result_for_operation(UUID(operation_id))

    assert result is not None
    assert [
        (action.type, action.payload.key_code)
        for action in result.actions
        if action.type in {"key_down", "key_up"}
    ] == [
        ("key_down", "ctrl"),
        ("key_down", "c"),
        ("key_up", "c"),
        ("key_up", "ctrl"),
        ("key_down", "ctrl"),
        ("key_up", "ctrl"),
    ]


@pytest.mark.asyncio
async def test_emergency_stop_releases_before_waiting_for_playback(tmp_path: Path) -> None:
    adapter = FakeInputAdapter()
    app = create_app(
        Settings(session_token="test-token", script_directory=tmp_path / "scripts"),
        adapter,
        FakeInputListener(),
    )
    headers = {"Authorization": "Bearer test-token"}
    data = {
        "id": "00000000-0000-0000-0000-000000000021",
        "name": "Held key",
        "createdAt": "2026-07-14T00:00:00Z",
        "updatedAt": "2026-07-14T00:00:00Z",
        "settings": {"countdownMs": 0},
        "actions": [
            {
                "id": "00000000-0000-0000-0000-000000000022",
                "type": "key_down",
                "payload": {"keyCode": "a", "scanCode": 30},
            },
            {
                "id": "00000000-0000-0000-0000-000000000023",
                "type": "wait",
                "payload": {"durationMs": 5000},
            },
        ],
    }
    async with app.router.lifespan_context(app):
        transport = asgi_transport(app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            started = await client.post(
                "/api/v1/playback/start",
                headers=headers,
                json={"inlineScript": data},
            )
            assert started.status_code == 202
            await asyncio.wait_for(asyncio.to_thread(adapter.action_recorded.wait), timeout=1)
            stopped = await client.post("/api/v1/emergency-stop", headers=headers)

    assert stopped.status_code == 200
    assert stopped.json()["releasedInputCount"] == 1
    assert stopped.json()["releaseFailures"] == []
    assert stopped.json()["state"] == "idle"
    assert adapter.pressed_keys == set()
