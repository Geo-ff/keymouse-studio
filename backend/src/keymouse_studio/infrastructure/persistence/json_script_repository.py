import asyncio
import json
import os
from pathlib import Path
from uuid import UUID, uuid4

from keymouse_studio.api.schemas.scripts import Script
from keymouse_studio.domain.errors import AppError, ErrorCode
from keymouse_studio.services.script_migrator import ScriptMigrator


class JsonScriptRepository:
    def __init__(self, directory: Path, migrator: ScriptMigrator | None = None) -> None:
        self._directory = directory
        self._migrator = migrator or ScriptMigrator()
        self._lock = asyncio.Lock()

    async def list(self) -> list[Script]:
        async with self._lock:
            await asyncio.to_thread(self._directory.mkdir, parents=True, exist_ok=True)
            paths = sorted(self._directory.glob("*.json"))
            return [await asyncio.to_thread(self._read, path) for path in paths]

    async def get(self, script_id: UUID) -> Script:
        async with self._lock:
            path = self._path(script_id)
            if not path.is_file():
                raise _not_found(script_id)
            return await asyncio.to_thread(self._read, path)

    async def create(self, script: Script) -> Script:
        async with self._lock:
            path = self._path(script.id)
            if path.exists():
                raise AppError(
                    ErrorCode.OPERATION_CONFLICT,
                    "Script already exists",
                    status_code=409,
                    details={"scriptId": str(script.id)},
                )
            await asyncio.to_thread(self._write_atomic, path, script)
            return script

    async def replace(self, script_id: UUID, script: Script) -> Script:
        async with self._lock:
            path = self._path(script_id)
            if not path.is_file():
                raise _not_found(script_id)
            await asyncio.to_thread(self._write_atomic, path, script)
            return script

    async def delete(self, script_id: UUID) -> None:
        async with self._lock:
            path = self._path(script_id)
            if not path.is_file():
                raise _not_found(script_id)
            await asyncio.to_thread(path.unlink)

    def _path(self, script_id: UUID) -> Path:
        return self._directory / f"{script_id}.json"

    def _read(self, path: Path) -> Script:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                "Stored script is invalid",
                status_code=422,
                details={"file": path.name},
            ) from exc
        if not isinstance(data, dict):
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                "Stored script must be a JSON object",
                status_code=422,
            )
        return self._migrator.load(data)

    def _write_atomic(self, path: Path, script: Script) -> None:
        self._directory.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
        try:
            with temporary.open("w", encoding="utf-8", newline="\n") as handle:
                json.dump(
                    script.model_dump(mode="json", by_alias=True),
                    handle,
                    ensure_ascii=False,
                    indent=2,
                )
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)


def _not_found(script_id: UUID) -> AppError:
    return AppError(
        ErrorCode.SCRIPT_NOT_FOUND,
        "Script not found",
        status_code=404,
        details={"scriptId": str(script_id)},
    )
