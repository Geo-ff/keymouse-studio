from __future__ import annotations

import asyncio
from pathlib import Path

import httpx
import pytest

from keymouse_studio.config import Settings
from keymouse_studio.domain.enums import MouseButton
from keymouse_studio.infrastructure.input.adapter import FakeInputAdapter
from keymouse_studio.infrastructure.input.listener import FakeInputListener, RawInputEvent
from keymouse_studio.main import create_app
from tests.conftest import asgi_transport

TOKEN = "phase-d-loop-token"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


def _app(tmp_path: Path, adapter: FakeInputAdapter, listener: FakeInputListener | None = None):
    return create_app(
        Settings(
            session_token=TOKEN,
            script_directory=tmp_path / "scripts",
            settings_file=tmp_path / "settings.json",
        ),
        adapter,
        listener or FakeInputListener(),
    )


@pytest.mark.asyncio
async def test_clicker_pause_resume_stop_and_state(tmp_path: Path) -> None:
    adapter = FakeInputAdapter()
    app = _app(tmp_path, adapter)
    async with app.router.lifespan_context(app):
        transport = asgi_transport(app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            started = await client.post(
                "/api/v1/clicker/start",
                headers=HEADERS,
                json={
                    "button": "left",
                    "clickCount": 1,
                    "intervalMs": 50,
                    "repeatMode": "infinite",
                    "repeatCount": 1,
                    "positionMode": "current",
                    "countdownMs": 0,
                },
            )
            assert started.status_code == 202
            body = started.json()
            operation_id = body["operationId"]
            assert body["snapshot"]["state"] in {"countdown", "running"}
            assert body["snapshot"]["operationType"] == "clicker"

            paused = await client.post(f"/api/v1/operations/{operation_id}/pause", headers=HEADERS)
            assert paused.status_code == 200
            assert paused.json()["state"] == "paused"

            resumed = await client.post(
                f"/api/v1/operations/{operation_id}/resume", headers=HEADERS
            )
            assert resumed.status_code == 200
            assert resumed.json()["state"] == "running"

            stopped = await client.post(f"/api/v1/operations/{operation_id}/stop", headers=HEADERS)
            assert stopped.status_code == 200
            assert stopped.json()["state"] == "idle"

            state = await client.get("/api/v1/state", headers=HEADERS)
            assert state.json()["state"] == "idle"
            assert state.json()["operationId"] is None


@pytest.mark.asyncio
async def test_recording_save_load_playback_emergency_stop(tmp_path: Path) -> None:
    adapter = FakeInputAdapter()
    listener = FakeInputListener()
    app = _app(tmp_path, adapter, listener)
    async with app.router.lifespan_context(app):
        transport = asgi_transport(app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            rec = await client.post(
                "/api/v1/recordings/start",
                headers=HEADERS,
                json={
                    "recordMouseMove": False,
                    "minMoveSampleMs": 10,
                    "moveErrorPx": 2,
                    "recordWheel": True,
                    "recordMouse": True,
                    "recordKeyboard": True,
                },
            )
            assert rec.status_code == 202
            rec_op = rec.json()["operationId"]

            listener.emit(RawInputEvent("key_down", 1, key_code="a", scan_code=30))
            listener.emit(RawInputEvent("key_up", 2_000_001, key_code="a", scan_code=30))
            listener.emit(RawInputEvent("mouse_button_down", 3_000_001, button=MouseButton.LEFT))
            await asyncio.sleep(0.05)

            stopped = await client.post(f"/api/v1/operations/{rec_op}/stop", headers=HEADERS)
            assert stopped.status_code == 200
            result_id = stopped.json()["recordingResultId"]
            recording = await client.get(f"/api/v1/recordings/{result_id}", headers=HEADERS)
            assert recording.status_code == 200
            actions = recording.json()["actions"]
            assert len(actions) >= 2

            created = await client.post(
                "/api/v1/scripts",
                headers=HEADERS,
                json={
                    "name": "阶段D闭环脚本",
                    "description": "录制生成",
                    "settings": {
                        "speedMultiplier": 1,
                        "loopMode": "count",
                        "loopCount": 1,
                        "countdownMs": 0,
                    },
                    "actions": actions,
                },
            )
            assert created.status_code == 201
            script = created.json()
            script_id = script["id"]

            listed = await client.get("/api/v1/scripts", headers=HEADERS)
            assert any(item["id"] == script_id for item in listed.json())

            loaded = await client.get(f"/api/v1/scripts/{script_id}", headers=HEADERS)
            assert loaded.status_code == 200
            assert loaded.json()["name"] == "阶段D闭环脚本"

            play = await client.post(
                "/api/v1/playback/start",
                headers=HEADERS,
                json={
                    "scriptId": script_id,
                    "inlineScript": None,
                    "speedMultiplier": 10,
                    "loopMode": "count",
                    "loopCount": 1,
                    "countdownMs": 0,
                },
            )
            assert play.status_code == 202
            play_op = play.json()["operationId"]
            assert play.json()["snapshot"]["operationType"] == "playback"

            paused = await client.post(f"/api/v1/operations/{play_op}/pause", headers=HEADERS)
            assert paused.json()["state"] == "paused"
            resumed = await client.post(f"/api/v1/operations/{play_op}/resume", headers=HEADERS)
            assert resumed.json()["state"] == "running"

            estop = await client.post("/api/v1/emergency-stop", headers=HEADERS)
            assert estop.status_code == 200
            assert estop.json()["state"] == "idle"
            state = await client.get("/api/v1/state", headers=HEADERS)
            assert state.json()["state"] == "idle"
            assert adapter.pressed == set()
            assert adapter.pressed_keys == set()


def test_websocket_state_snapshot_and_progress(tmp_path: Path) -> None:
    import time
    from collections.abc import Awaitable, Callable, MutableMapping
    from typing import Any

    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    AsgiReceive = Callable[[], Awaitable[dict[str, Any]]]
    AsgiSend = Callable[[MutableMapping[str, Any]], Awaitable[None]]

    def with_client_host(app: FastAPI, host: str) -> Callable[..., Awaitable[None]]:
        async def wrapped(
            scope: MutableMapping[str, Any], receive: AsgiReceive, send: AsgiSend
        ) -> None:
            scope["client"] = (host, 50000)
            await app(scope, receive, send)

        return wrapped

    adapter = FakeInputAdapter()
    app = _app(tmp_path, adapter)
    with TestClient(with_client_host(app, "127.0.0.1")) as client:
        with client.websocket_connect(
            f"/api/v1/events?token={TOKEN}",
            headers={"Origin": "http://127.0.0.1:5173"},
        ) as ws:
            first = ws.receive_json()
            assert first["type"] == "engine.state_snapshot"
            assert first["payload"]["state"] == "idle"

            started = client.post(
                "/api/v1/clicker/start",
                headers=HEADERS,
                json={
                    "button": "right",
                    "clickCount": 1,
                    "intervalMs": 20,
                    "repeatMode": "count",
                    "repeatCount": 2,
                    "positionMode": "current",
                    "countdownMs": 0,
                },
            )
            assert started.status_code == 202
            operation_id = started.json()["operationId"]

            saw_running = False
            for _ in range(30):
                event = ws.receive_json()
                if event["type"] in {
                    "operation.state_changed",
                    "operation.progress",
                    "engine.state_snapshot",
                }:
                    payload = event["payload"]
                    if payload.get("operationId") == operation_id and payload.get("state") in {
                        "running",
                        "countdown",
                    }:
                        saw_running = True
                        break
            assert saw_running

        end = time.monotonic() + 2
        while time.monotonic() < end:
            state = client.get("/api/v1/state", headers=HEADERS).json()
            if state["state"] == "idle":
                break
            time.sleep(0.05)
        assert client.get("/api/v1/state", headers=HEADERS).json()["state"] == "idle"
        assert adapter.actions.count(("down", MouseButton.RIGHT)) == 2


@pytest.mark.asyncio
async def test_structured_validation_error_and_conflict(tmp_path: Path) -> None:
    adapter = FakeInputAdapter()
    app = _app(tmp_path, adapter)
    async with app.router.lifespan_context(app):
        transport = asgi_transport(app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            bad = await client.post(
                "/api/v1/clicker/start",
                headers=HEADERS,
                json={"positionMode": "fixed", "x": 1},
            )
            assert bad.status_code == 422
            err = bad.json()["error"]
            assert err["code"] == "VALIDATION_ERROR"
            assert "details" in err

            first = await client.post(
                "/api/v1/clicker/start",
                headers=HEADERS,
                json={
                    "button": "left",
                    "intervalMs": 100,
                    "repeatMode": "infinite",
                    "repeatCount": 1,
                    "positionMode": "current",
                    "countdownMs": 0,
                },
            )
            assert first.status_code == 202
            conflict = await client.post(
                "/api/v1/clicker/start",
                headers=HEADERS,
                json={
                    "button": "left",
                    "intervalMs": 100,
                    "repeatMode": "count",
                    "repeatCount": 1,
                    "positionMode": "current",
                    "countdownMs": 0,
                },
            )
            assert conflict.status_code == 409
            assert conflict.json()["error"]["code"] == "OPERATION_CONFLICT"
            op = first.json()["operationId"]
            await client.post(f"/api/v1/operations/{op}/stop", headers=HEADERS)


@pytest.mark.asyncio
async def test_mouse_position_uses_fake_input_and_requires_authentication(tmp_path: Path) -> None:
    adapter = FakeInputAdapter(position=(-320, 1440))
    app = _app(tmp_path, adapter)
    async with app.router.lifespan_context(app):
        transport = asgi_transport(app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            unauthorized = await client.get("/api/v1/mouse-position")
            assert unauthorized.status_code == 401

            first = await client.get("/api/v1/mouse-position", headers=HEADERS)
            assert first.status_code == 200
            assert first.json() == {"x": -320, "y": 1440}

            adapter.position = (1920, 0)
            second = await client.get("/api/v1/mouse-position", headers=HEADERS)
            assert second.json() == {"x": 1920, "y": 0}


@pytest.mark.asyncio
async def test_inline_script_playback_without_persisted_id(tmp_path: Path) -> None:
    adapter = FakeInputAdapter()
    app = _app(tmp_path, adapter)
    script = {
        "schemaVersion": 1,
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "inline",
        "description": "",
        "createdAt": "2026-07-14T00:00:00Z",
        "updatedAt": "2026-07-14T00:00:00Z",
        "settings": {
            "speedMultiplier": 1,
            "loopMode": "count",
            "loopCount": 1,
            "countdownMs": 0,
        },
        "actions": [
            {
                "id": "22222222-2222-2222-2222-222222222222",
                "type": "mouse_click",
                "enabled": True,
                "delayBeforeMs": 0,
                "payload": {
                    "button": "left",
                    "clickCount": 1,
                    "x": None,
                    "y": None,
                    "intervalMs": 0,
                },
            }
        ],
    }
    async with app.router.lifespan_context(app):
        transport = asgi_transport(app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            play = await client.post(
                "/api/v1/playback/start",
                headers=HEADERS,
                json={
                    "scriptId": None,
                    "inlineScript": script,
                    "speedMultiplier": 5,
                    "loopMode": "count",
                    "loopCount": 1,
                    "countdownMs": 0,
                },
            )
            assert play.status_code == 202
            await asyncio.wait_for(app.state.playback_service.wait_finished(), timeout=2)
            assert adapter.actions.count(("down", MouseButton.LEFT)) >= 1