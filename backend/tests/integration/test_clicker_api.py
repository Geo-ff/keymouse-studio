import asyncio

import httpx
import pytest

from keymouse_studio.config import Settings
from keymouse_studio.domain.enums import MouseButton
from keymouse_studio.infrastructure.input.adapter import FakeInputAdapter
from keymouse_studio.main import create_app


@pytest.mark.asyncio
async def test_clicker_api_runs_and_reports_state() -> None:
    adapter = FakeInputAdapter()
    settings = Settings(session_token="test-token")
    app = create_app(settings, adapter)
    transport = httpx.ASGITransport(app=app)
    headers = {"Authorization": "Bearer test-token"}
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/clicker/start",
                headers=headers,
                json={
                    "button": "middle",
                    "clickCount": 1,
                    "intervalMs": 1,
                    "repeatMode": "count",
                    "repeatCount": 2,
                    "positionMode": "current",
                    "countdownMs": 0,
                },
            )
            assert response.status_code == 202
            operation_id = response.json()["operationId"]

            await asyncio.wait_for(app.state.clicker_service.wait_finished(), timeout=1)
            state = await client.get("/api/v1/state", headers=headers)
            assert state.json()["state"] == "idle"

            wrong_id = "00000000-0000-0000-0000-000000000000"
            conflict = await client.post(f"/api/v1/operations/{wrong_id}/pause", headers=headers)
            assert conflict.status_code == 409
            assert conflict.json()["error"]["operationId"] is None
            assert operation_id
    finally:
        await app.state.clicker_service.shutdown()

    assert adapter.actions.count(("down", MouseButton.MIDDLE)) == 2
    assert adapter.actions.count(("up", MouseButton.MIDDLE)) == 2


@pytest.mark.asyncio
async def test_clicker_api_validates_fixed_position() -> None:
    adapter = FakeInputAdapter()
    app = create_app(Settings(session_token="test-token"), adapter)
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/clicker/start",
                headers={"Authorization": "Bearer test-token"},
                json={"positionMode": "fixed", "x": 10},
            )
    finally:
        await app.state.clicker_service.shutdown()

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
