import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest

from keymouse_studio.api.schemas.scripts import Script
from keymouse_studio.domain.errors import AppError, ErrorCode
from keymouse_studio.infrastructure.persistence.json_script_repository import JsonScriptRepository
from keymouse_studio.services.script_migrator import ScriptMigrator


def make_script(name: str = "测试脚本") -> Script:
    now = datetime.now(UTC)
    return Script(id=uuid4(), name=name, created_at=now, updated_at=now)


@pytest.mark.asyncio
async def test_repository_crud_and_unicode(tmp_path: Path) -> None:
    repository = JsonScriptRepository(tmp_path)
    script = make_script()
    assert await repository.create(script) == script
    assert await repository.get(script.id) == script
    assert await repository.list() == [script]

    updated = script.model_copy(update={"name": "更新后的脚本"})
    assert await repository.replace(script.id, updated) == updated
    stored = json.loads((tmp_path / f"{script.id}.json").read_text(encoding="utf-8"))
    assert stored["name"] == "更新后的脚本"

    await repository.delete(script.id)
    with pytest.raises(AppError) as exc_info:
        await repository.get(script.id)
    assert exc_info.value.code == ErrorCode.SCRIPT_NOT_FOUND


def test_migrator_rejects_future_version() -> None:
    with pytest.raises(AppError) as exc_info:
        ScriptMigrator().load({"schemaVersion": 2})
    assert exc_info.value.code == ErrorCode.SCRIPT_VERSION_UNSUPPORTED


@pytest.mark.asyncio
async def test_failed_atomic_replace_preserves_existing_script(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repository = JsonScriptRepository(tmp_path)
    script = make_script("original")
    await repository.create(script)

    def fail_replace(source: Path, destination: Path) -> None:
        raise OSError("replace failed")

    monkeypatch.setattr("os.replace", fail_replace)
    with pytest.raises(OSError):
        await repository.replace(script.id, script.model_copy(update={"name": "changed"}))

    assert await repository.get(script.id) == script
    temporary_files = await asyncio.to_thread(lambda: list(tmp_path.glob("*.tmp")))
    assert not temporary_files


@pytest.mark.asyncio
async def test_repository_rejects_corrupt_json(tmp_path: Path) -> None:
    script_id = uuid4()
    (tmp_path / f"{script_id}.json").write_text("{broken", encoding="utf-8")
    repository = JsonScriptRepository(tmp_path)
    with pytest.raises(AppError) as exc_info:
        await repository.get(script_id)
    assert exc_info.value.code == ErrorCode.VALIDATION_ERROR
