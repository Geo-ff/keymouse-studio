from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from keymouse_studio.api.schemas.scripts import Script, ScriptCreate, ScriptUpdate
from keymouse_studio.domain.errors import AppError, ErrorCode
from keymouse_studio.infrastructure.persistence.json_script_repository import JsonScriptRepository
from keymouse_studio.services.script_migrator import ScriptMigrator


class ScriptService:
    def __init__(self, repository: JsonScriptRepository) -> None:
        self._repository = repository
        self._migrator = ScriptMigrator()

    def validate(self, data: dict[str, Any]) -> Script:
        return self._migrator.load(data)

    async def create(self, request: ScriptCreate) -> Script:
        now = datetime.now(UTC)
        script = Script(
            id=uuid4(),
            name=request.name,
            description=request.description,
            created_at=now,
            updated_at=now,
            settings=request.settings,
            actions=request.actions,
        )
        return await self._repository.create(script)

    async def list(self) -> list[Script]:
        return await self._repository.list()

    async def get(self, script_id: UUID) -> Script:
        return await self._repository.get(script_id)

    async def replace(self, script_id: UUID, request: ScriptUpdate) -> Script:
        if request.id != script_id:
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                "Path and body script IDs must match",
                status_code=422,
            )
        existing = await self._repository.get(script_id)
        script = Script(
            id=script_id,
            name=request.name,
            description=request.description,
            created_at=existing.created_at,
            updated_at=datetime.now(UTC),
            settings=request.settings,
            actions=request.actions,
        )
        return await self._repository.replace(script_id, script)

    async def duplicate(self, script_id: UUID) -> Script:
        existing = await self._repository.get(script_id)
        now = datetime.now(UTC)
        duplicate = existing.model_copy(
            update={
                "id": uuid4(),
                "name": f"{existing.name} copy",
                "created_at": now,
                "updated_at": now,
            }
        )
        return await self._repository.create(duplicate)

    async def delete(self, script_id: UUID) -> None:
        await self._repository.delete(script_id)
