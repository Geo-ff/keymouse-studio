import httpx
import pytest


@pytest.mark.asyncio
async def test_health_is_public(client: httpx.AsyncClient) -> None:
    response = await client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "appVersion": "0.1.0",
        "protocolVersion": 1,
        "engineState": "idle",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/api/v1/capabilities", "/api/v1/state"])
async def test_protected_routes_require_session_token(client: httpx.AsyncClient, path: str) -> None:
    response = await client.get(path)

    assert response.status_code == 401
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {
        "error": {
            "code": "UNAUTHORIZED_LOCAL_CLIENT",
            "message": "Invalid or missing local session token",
            "details": {},
            "retryable": False,
            "operationId": None,
        }
    }


@pytest.mark.asyncio
async def test_unknown_route_uses_unified_error_response(client: httpx.AsyncClient) -> None:
    response = await client.get("/missing")

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "Not Found",
            "details": {},
            "retryable": False,
            "operationId": None,
        }
    }


@pytest.mark.asyncio
async def test_documentation_endpoints_are_disabled(client: httpx.AsyncClient) -> None:
    for path in ("/docs", "/redoc", "/openapi.json"):
        response = await client.get(path)
        assert response.status_code == 404


@pytest.mark.asyncio
async def test_capabilities_returns_safe_skeleton(
    client: httpx.AsyncClient, auth_headers: dict[str, str]
) -> None:
    response = await client.get("/api/v1/capabilities", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {
        "platform": "windows",
        "inputAvailable": False,
        "globalHotkeyAvailable": False,
        "displayCount": 0,
        "dpiAware": False,
    }


@pytest.mark.asyncio
async def test_state_returns_complete_idle_snapshot(
    client: httpx.AsyncClient, auth_headers: dict[str, str]
) -> None:
    response = await client.get("/api/v1/state", headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {
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
    }
