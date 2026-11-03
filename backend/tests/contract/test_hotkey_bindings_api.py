import json
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI

from keymouse_studio.config import Settings
from keymouse_studio.infrastructure.input.adapter import FakeInputAdapter
from keymouse_studio.main import create_app
from tests.conftest import asgi_transport

SCRIPT_ID = "00000000-0000-4000-8000-0000000000aa"
OTHER_ID = "00000000-0000-4000-8000-0000000000bb"


def settings_payload(**overrides: object) -> dict[str, object]:
    return {
        "defaultSpeedMultiplier": 1.0,
        "defaultLoopMode": "count",
        "defaultLoopCount": 1,
        "defaultCountdownMs": 3000,
        "emergencyStopHotkey": "F12",
        "recordStartHotkey": "F9",
        **overrides,
    }


@pytest.mark.asyncio
async def test_clicker_and_script_hotkeys_are_normalized_and_persisted(
    app: FastAPI,
    client: httpx.AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    async with app.router.lifespan_context(app):
        initial = await client.get("/api/v1/settings", headers=auth_headers)
        updated = await client.put(
            "/api/v1/settings",
            headers=auth_headers,
            json=settings_payload(
                clickerToggleHotkey="F6",
                scriptHotkeys={SCRIPT_ID: "Ctrl + 1", OTHER_ID: ""},
            ),
        )

    assert initial.json()["clickerToggleHotkey"] == ""
    assert initial.json()["scriptHotkeys"] == {}
    assert updated.status_code == 200, updated.text
    assert updated.json()["clickerToggleHotkey"] == "f6"
    # An empty hotkey unbinds instead of being stored.
    assert updated.json()["scriptHotkeys"] == {SCRIPT_ID: "ctrl+1"}
    stored = json.loads(app.state.settings.settings_file.read_text(encoding="utf-8"))
    assert stored["scriptHotkeys"] == {SCRIPT_ID: "ctrl+1"}


@pytest.mark.parametrize(
    "overrides",
    [
        {"clickerToggleHotkey": "F9"},  # same as recordStartHotkey
        {"scriptHotkeys": {SCRIPT_ID: "f12"}},  # same as emergency stop
        {"clickerToggleHotkey": "F6", "scriptHotkeys": {SCRIPT_ID: "F6"}},
        {"scriptHotkeys": {SCRIPT_ID: "ctrl+1", OTHER_ID: "Ctrl+1"}},
    ],
)
@pytest.mark.asyncio
async def test_hotkeys_must_be_unique_across_controls_and_scripts(
    client: httpx.AsyncClient,
    auth_headers: dict[str, str],
    overrides: dict[str, object],
) -> None:
    response = await client.put(
        "/api/v1/settings", headers=auth_headers, json=settings_payload(**overrides)
    )

    assert response.status_code == 422
    assert "快捷键不能重复配置" in response.text


@pytest.mark.asyncio
async def test_deleting_a_script_removes_its_hotkey(
    app: FastAPI,
    client: httpx.AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    async with app.router.lifespan_context(app):
        created = await client.post(
            "/api/v1/scripts",
            headers=auth_headers,
            json={"name": "常用脚本", "actions": []},
        )
        script_id = created.json()["id"]
        await client.put(
            "/api/v1/settings",
            headers=auth_headers,
            json=settings_payload(scriptHotkeys={script_id: "F7", OTHER_ID: "F8"}),
        )
        deleted = await client.delete(f"/api/v1/scripts/{script_id}", headers=auth_headers)
        after = await client.get("/api/v1/settings", headers=auth_headers)

    assert deleted.status_code == 204
    assert after.json()["scriptHotkeys"] == {OTHER_ID: "f8"}
    stored = json.loads(app.state.settings.settings_file.read_text(encoding="utf-8"))
    assert stored["scriptHotkeys"] == {OTHER_ID: "f8"}


@pytest.mark.asyncio
async def test_keyboard_clicker_rejects_keys_bound_to_a_script(tmp_path: Path) -> None:
    app = create_app(
        Settings(session_token="test-token", settings_file=tmp_path / "settings.json"),
        FakeInputAdapter(),
    )
    headers = {"Authorization": "Bearer test-token"}
    transport = asgi_transport(app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            await client.put(
                "/api/v1/settings",
                headers=headers,
                json=settings_payload(scriptHotkeys={SCRIPT_ID: "Q"}),
            )
            response = await client.post(
                "/api/v1/clicker/start",
                headers=headers,
                json={
                    "inputType": "keyboard",
                    "keys": [{"keyCode": "q", "scanCode": None, "extended": False}],
                    "repeatMode": "count",
                    "repeatCount": 1,
                    "countdownMs": 0,
                },
            )
    finally:
        await app.state.clicker_service.shutdown()

    assert response.status_code == 422
    assert response.json()["error"]["message"] == "键盘连点组合不能与脚本快捷键相同"
