import httpx
import pytest

from keymouse_studio.config import Settings


def test_settings_generate_unique_session_tokens() -> None:
    assert Settings().session_token != Settings().session_token


def test_settings_accept_valid_ip_hosts() -> None:
    assert Settings(host="0.0.0.0").host == "0.0.0.0"
    assert Settings(host="::1").host == "::1"


def test_settings_reject_invalid_host() -> None:
    with pytest.raises(ValueError):
        Settings(host="not-an-ip")


@pytest.mark.asyncio
async def test_cors_allows_only_explicit_loopback_vite_origin(
    client: httpx.AsyncClient,
) -> None:
    allowed = await client.options(
        "/api/v1/settings",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        },
    )
    electron = await client.get(
        "/api/v1/health",
        headers={"Origin": "null"},
    )
    denied = await client.get(
        "/api/v1/health",
        headers={"Origin": "https://example.com"},
    )

    assert allowed.status_code == 204
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert allowed.headers["access-control-allow-headers"] == "Authorization, Content-Type"
    assert electron.status_code == 200
    assert electron.headers["access-control-allow-origin"] == "null"
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "ORIGIN_NOT_ALLOWED"
    assert "access-control-allow-origin" not in denied.headers
