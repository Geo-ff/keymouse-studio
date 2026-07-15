import asyncio
import json
import os
from pathlib import Path
from uuid import uuid4

from pydantic import ValidationError

from keymouse_studio.api.schemas.settings import ApplicationSettings
from keymouse_studio.domain.errors import AppError, ErrorCode


class JsonSettingsRepository:
    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = asyncio.Lock()

    async def load(self) -> ApplicationSettings:
        async with self._lock:
            if not self._path.is_file():
                return ApplicationSettings()
            return await asyncio.to_thread(self._read)

    async def save(self, settings: ApplicationSettings) -> ApplicationSettings:
        async with self._lock:
            await asyncio.to_thread(self._write_atomic, settings)
            return settings

    def _read(self) -> ApplicationSettings:
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            return ApplicationSettings.model_validate(data)
        except (OSError, UnicodeError, json.JSONDecodeError, ValidationError) as exc:
            raise AppError(
                ErrorCode.SETTINGS_INVALID,
                "Stored settings are invalid",
                status_code=422,
                details={"file": self._path.name},
            ) from exc

    def _write_atomic(self, settings: ApplicationSettings) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self._path.with_name(f".{self._path.name}.{uuid4().hex}.tmp")
        try:
            with temporary.open("w", encoding="utf-8", newline="\n") as handle:
                json.dump(
                    settings.model_dump(mode="json", by_alias=True),
                    handle,
                    ensure_ascii=False,
                    indent=2,
                )
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, self._path)
        finally:
            temporary.unlink(missing_ok=True)