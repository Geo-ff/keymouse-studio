from collections.abc import Callable
from typing import Any

from pydantic import ValidationError

from keymouse_studio.api.schemas.scripts import CURRENT_SCHEMA_VERSION, Script
from keymouse_studio.domain.errors import AppError, ErrorCode

Migrator = Callable[[dict[str, Any]], dict[str, Any]]


class ScriptMigrator:
    def __init__(self, migrators: dict[int, Migrator] | None = None) -> None:
        self._migrators = migrators or {}

    def load(self, data: dict[str, Any]) -> Script:
        version = data.get("schemaVersion")
        if not isinstance(version, int) or isinstance(version, bool) or version < 1:
            raise AppError(
                ErrorCode.SCRIPT_VERSION_UNSUPPORTED,
                "脚本 schemaVersion 必须是正整数",
                status_code=422,
            )
        if version > CURRENT_SCHEMA_VERSION:
            raise AppError(
                ErrorCode.SCRIPT_VERSION_UNSUPPORTED,
                f"脚本 schemaVersion {version} 不受支持",
                status_code=422,
                details={"schemaVersion": version, "supportedVersion": CURRENT_SCHEMA_VERSION},
            )
        migrated = dict(data)
        while version < CURRENT_SCHEMA_VERSION:
            migrator = self._migrators.get(version)
            if migrator is None:
                raise AppError(
                    ErrorCode.SCRIPT_VERSION_UNSUPPORTED,
                    f"没有可用的 schemaVersion {version} 迁移",
                    status_code=422,
                )
            migrated = migrator(migrated)
            version += 1
            migrated["schemaVersion"] = version
        try:
            return Script.model_validate(migrated)
        except ValidationError as exc:
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                "脚本校验失败",
                status_code=422,
                details={"errors": _serializable_errors(exc)},
            ) from exc


def _serializable_errors(exc: ValidationError) -> list[dict[str, Any]]:
    return [
        {
            "path": ".".join(str(part) for part in error["loc"]),
            "type": error["type"],
            "message": error["msg"],
        }
        for error in exc.errors()
    ]
