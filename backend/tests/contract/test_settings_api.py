import asyncio
import json
import os
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI

from keymouse_studio.api.schemas.settings import ApplicationSettings
from keymouse_studio.domain.errors import AppError, ErrorCode
from keymouse_studio.infrastructure.persistence.json_settings_repository import (
    JsonSettingsRepository,
)


@pytest.mark.asyncio
async def test_settings_get_put_persists_public_values_atomically(
    app: FastAPI,
    client: httpx.AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    async with app.router.lifespan_context(app):
        initial = await client.get("/api/v1/settings", headers=auth_headers)
        updated = await client.put(
            "/api/v1/settings",
            headers=auth_headers,
            json={
                "defaultSpeedMultiplier": 1.5,
                "defaultLoopMode": "count",
                "defaultLoopCount": 4,
                "defaultCountdownMs": 1000,
                "emergencyStopHotkey": "Ctrl + Shift + F11",
            },
        )

    assert initial.json()["emergencyStopHotkey"] == "f12"
    assert updated.status_code == 200
    assert updated.json()["emergencyStopHotkey"] == "ctrl+shift+f11"
    stored = json.loads(app.state.settings.settings_file.read_text(encoding="utf-8"))
    assert stored == updated.json()
    assert "token" not in json.dumps(stored).lower()
    assert "secret" not in json.dumps(stored).lower()
    assert app.state.hotkey_service.hotkey == "ctrl+shift+f11"


@pytest.mark.asyncio
async def test_settings_rejects_sensitive_and_partial_payloads(
    client: httpx.AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    for data in ({"sessionToken": "secret"}, {"defaultLoopCount": 2}):
        response = await client.put("/api/v1/settings", headers=auth_headers, json=data)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_hotkey_validate_normalizes_and_reports_unknown_occupancy(
    client: httpx.AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.post(
        "/api/v1/hotkeys/validate",
        headers=auth_headers,
        json={"hotkey": "Shift+Ctrl+F10"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "valid": True,
        "normalizedHotkey": "ctrl+shift+f10",
        "availability": "unavailable",
        "reason": "Global hotkey occupancy cannot be reliably detected by the input listener",
    }


@pytest.mark.asyncio
async def test_hotkey_validate_rejects_invalid_chord(
    client: httpx.AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    response = await client.post(
        "/api/v1/hotkeys/validate",
        headers=auth_headers,
        json={"hotkey": "ctrl+alt"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_failed_settings_replace_preserves_existing_file(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = JsonSettingsRepository(tmp_path / "settings.json")
    original = ApplicationSettings()
    await repository.save(original)

    def fail_replace(source: Path, destination: Path) -> None:
        raise OSError("replace failed")

    monkeypatch.setattr(os, "replace", fail_replace)
    with pytest.raises(OSError, match="replace failed"):
        await repository.save(original.model_copy(update={"default_loop_count": 2}))

    assert await repository.load() == original
    temporary_files = await asyncio.to_thread(lambda: list(tmp_path.glob("*.tmp")))
    assert not temporary_files


@pytest.mark.asyncio
async def test_corrupt_settings_return_structured_error(tmp_path: Path) -> None:
    path = tmp_path / "settings.json"
    path.write_text("{broken", encoding="utf-8")

    with pytest.raises(AppError) as exc_info:
        await JsonSettingsRepository(path).load()

    assert exc_info.value.code == ErrorCode.SETTINGS_INVALID