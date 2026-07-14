from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from keymouse_studio.api.routers import capabilities, events, health, operations, scripts
from keymouse_studio.api.schemas.common import ErrorDetail, ErrorResponse
from keymouse_studio.config import Settings
from keymouse_studio.dependencies import require_session_token
from keymouse_studio.domain.errors import AppError, ErrorCode
from keymouse_studio.infrastructure.persistence.json_script_repository import JsonScriptRepository
from keymouse_studio.services.event_service import EventService
from keymouse_studio.services.operation_service import OperationService
from keymouse_studio.services.script_service import ScriptService

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield


def _error_response(detail: ErrorDetail, status_code: int) -> JSONResponse:
    response = ErrorResponse(error=detail)
    return JSONResponse(
        status_code=status_code,
        content=response.model_dump(mode="json", by_alias=True),
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    app = FastAPI(
        title="KeyMouse Studio API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app_settings = settings or Settings()
    event_service = EventService(app_settings.protocol_version)
    app.state.settings = app_settings
    app.state.operation_service = OperationService(event_service)
    app.state.script_service = ScriptService(JsonScriptRepository(app_settings.script_directory))

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return _error_response(
            ErrorDetail(
                code=exc.code,
                message=exc.message,
                details=exc.details,
                retryable=exc.retryable,
                operation_id=exc.operation_id,
            ),
            exc.status_code,
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return _error_response(
            ErrorDetail(
                code=ErrorCode.VALIDATION_ERROR,
                message="Request validation failed",
                details={
                    "errors": [
                        {
                            "path": ".".join(str(part) for part in error["loc"]),
                            "type": error["type"],
                            "message": error["msg"],
                        }
                        for error in exc.errors()
                    ]
                },
            ),
            422,
        )

    @app.exception_handler(HTTPException)
    async def handle_http_error(request: Request, exc: HTTPException) -> JSONResponse:
        return _error_response(
            ErrorDetail(
                code=ErrorCode.VALIDATION_ERROR,
                message=str(exc.detail),
            ),
            exc.status_code,
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        return _error_response(
            ErrorDetail(
                code=ErrorCode.ENGINE_INTERNAL_ERROR,
                message="Internal engine error",
            ),
            500,
        )

    app.include_router(health.router, prefix=API_PREFIX)
    protected_dependencies = [Depends(require_session_token)]
    app.include_router(
        capabilities.router,
        prefix=API_PREFIX,
        dependencies=protected_dependencies,
    )
    app.include_router(
        operations.router,
        prefix=API_PREFIX,
        dependencies=protected_dependencies,
    )
    app.include_router(
        scripts.router,
        prefix=API_PREFIX,
        dependencies=protected_dependencies,
    )
    app.include_router(events.router, prefix=API_PREFIX)
    return app


app = create_app()
