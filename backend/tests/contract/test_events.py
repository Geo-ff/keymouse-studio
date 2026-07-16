from collections.abc import Awaitable, Callable, MutableMapping
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from keymouse_studio.config import Settings
from keymouse_studio.infrastructure.input.adapter import FakeInputAdapter
from keymouse_studio.infrastructure.input.listener import FakeInputListener
from keymouse_studio.main import create_app
from tests.conftest import SESSION_TOKEN

AsgiReceive = Callable[[], Awaitable[dict[str, Any]]]
AsgiSend = Callable[[MutableMapping[str, Any]], Awaitable[None]]


def with_client_host(app: FastAPI, host: str) -> Callable[..., Awaitable[None]]:
    async def wrapped(
        scope: MutableMapping[str, Any], receive: AsgiReceive, send: AsgiSend
    ) -> None:
        scope["client"] = (host, 50000)
        await app(scope, receive, send)

    return wrapped


def test_events_first_frame_is_complete_state_snapshot(app: FastAPI) -> None:
    with TestClient(app) as client:
        with client.websocket_connect(
            "/api/v1/events",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
        ) as websocket:
            event = websocket.receive_json()
            assert event["protocolVersion"] == 1
            assert event["sequence"] == 1
            assert event["eventId"]
            assert event["timestamp"].endswith("Z")
            assert event["operationId"] is None
            assert event["type"] == "engine.state_snapshot"
            assert event["payload"] == {
                "operationId": None,
                "operationType": None,
                "state": "idle",
                "sequence": 1,
                "startedAt": None,
                "elapsedMs": 0,
                "progress": None,
                "currentActionIndex": None,
                "completedCount": 0,
                "countdownRemainingMs": 0,
                "error": None,
            }


def test_events_reject_invalid_session_token(app: FastAPI) -> None:
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect(
                "/api/v1/events",
                headers={"Authorization": "Bearer invalid"},
            ):
                pass

    assert exc_info.value.code == 1008


def test_events_allow_query_token_for_loopback_browser(app: FastAPI) -> None:
    with TestClient(with_client_host(app, "127.0.0.1")) as client:
        with client.websocket_connect(
            f"/api/v1/events?token={SESSION_TOKEN}",
            headers={"Origin": "http://localhost:5173"},
        ) as websocket:
            assert websocket.receive_json()["type"] == "engine.state_snapshot"


@pytest.mark.parametrize("origin", ["null", "file://"])
def test_events_allow_query_token_for_electron_file_origin(
    app: FastAPI, origin: str
) -> None:
    with TestClient(with_client_host(app, "127.0.0.1")) as client:
        with client.websocket_connect(
            f"/api/v1/events?token={SESSION_TOKEN}",
            headers={"Origin": origin},
        ) as websocket:
            assert websocket.receive_json()["type"] == "engine.state_snapshot"


@pytest.mark.parametrize(
    ("configured_host", "client_host"),
    [("0.0.0.0", "127.0.0.1"), ("127.0.0.1", "192.0.2.10")],
)
def test_events_reject_query_token_unless_both_hosts_are_loopback(
    configured_host: str,
    client_host: str,
    tmp_path: Any,
) -> None:
    app = create_app(
        Settings(
            host=configured_host,
            session_token=SESSION_TOKEN,
            script_directory=tmp_path / "scripts",
            settings_file=tmp_path / "settings.json",
        ),
        FakeInputAdapter(),
        FakeInputListener(),
    )
    with TestClient(with_client_host(app, client_host)) as client:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect(f"/api/v1/events?token={SESSION_TOKEN}"):
                pass

    assert exc_info.value.code == 1008


def test_events_authorization_header_remains_valid_on_non_loopback_host(
    tmp_path: Any,
) -> None:
    app = create_app(
        Settings(
            host="0.0.0.0",
            session_token=SESSION_TOKEN,
            script_directory=tmp_path / "scripts",
            settings_file=tmp_path / "settings.json",
        ),
        FakeInputAdapter(),
        FakeInputListener(),
    )
    with TestClient(with_client_host(app, "192.0.2.10")) as client:
        with client.websocket_connect(
            "/api/v1/events",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
        ) as websocket:
            assert websocket.receive_json()["type"] == "engine.state_snapshot"


def test_events_reject_untrusted_browser_origin(app: FastAPI) -> None:
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect(
                "/api/v1/events",
                headers={
                    "Authorization": f"Bearer {SESSION_TOKEN}",
                    "Origin": "https://example.com",
                },
            ):
                pass

    assert exc_info.value.code == 1008


@pytest.mark.asyncio
async def test_snapshot_is_not_broadcast_to_existing_subscribers(app: FastAPI) -> None:
    queue = app.state.event_service.subscribe()

    snapshot = await app.state.operation_service.snapshot_event()

    assert snapshot.type == "engine.state_snapshot"
    assert queue.empty()
