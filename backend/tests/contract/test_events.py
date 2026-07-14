import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from tests.conftest import SESSION_TOKEN


def test_events_first_frame_is_complete_state_snapshot(app: FastAPI) -> None:
    with TestClient(app) as client:
        with client.websocket_connect(
            "/api/v1/events",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
        ) as websocket:
            assert websocket.receive_json() == {
                "protocolVersion": 1,
                "type": "engine.state_snapshot",
                "payload": {
                    "operationId": None,
                    "operationType": None,
                    "state": "idle",
                    "sequence": 0,
                    "startedAt": None,
                    "elapsedMs": 0,
                    "progress": None,
                    "currentActionIndex": None,
                    "completedCount": 0,
                    "countdownRemainingMs": 0,
                    "error": None,
                },
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
