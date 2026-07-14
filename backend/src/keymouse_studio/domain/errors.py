from enum import StrEnum
from typing import Any


class ErrorCode(StrEnum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED_LOCAL_CLIENT = "UNAUTHORIZED_LOCAL_CLIENT"
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
            "Invalid or missing local session token",
            status_code=401,
        )
