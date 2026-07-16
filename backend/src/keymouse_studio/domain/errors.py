from enum import StrEnum
from typing import Any


class ErrorCode(StrEnum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED_LOCAL_CLIENT = "UNAUTHORIZED_LOCAL_CLIENT"
    ORIGIN_NOT_ALLOWED = "ORIGIN_NOT_ALLOWED"
    NOT_FOUND = "NOT_FOUND"
    METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED"
    OPERATION_CONFLICT = "OPERATION_CONFLICT"
    INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
    SCRIPT_NOT_FOUND = "SCRIPT_NOT_FOUND"
    SCRIPT_VERSION_UNSUPPORTED = "SCRIPT_VERSION_UNSUPPORTED"
    SETTINGS_INVALID = "SETTINGS_INVALID"
    HOTKEY_REGISTRATION_FAILED = "HOTKEY_REGISTRATION_FAILED"
    INPUT_PERMISSION_DENIED = "INPUT_PERMISSION_DENIED"
    DISPLAY_LAYOUT_CHANGED = "DISPLAY_LAYOUT_CHANGED"
    ENGINE_INTERNAL_ERROR = "ENGINE_INTERNAL_ERROR"


class AppError(Exception):
    def __init__(
        self,
        code: ErrorCode,
        message: str,
        *,
        status_code: int,
        details: dict[str, Any] | None = None,
        retryable: bool = False,
        operation_id: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        self.retryable = retryable
        self.operation_id = operation_id


class UnauthorizedError(AppError):
    def __init__(self) -> None:
        super().__init__(
            ErrorCode.UNAUTHORIZED_LOCAL_CLIENT,
            "本地会话无效或缺失, 请重启应用",
            status_code=401,
        )
