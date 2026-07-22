from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from keymouse_studio.infrastructure.system.dpi import enable_per_monitor_dpi_awareness

enable_per_monitor_dpi_awareness()

from keymouse_studio.api.routers import (
    capabilities,
    clicker,
    events,
    health,
    operations,
    playback,
    recording,
    scripts,
)
from keymouse_studio.api.routers import (
    settings as settings_router,
)
from keymouse_studio.api.schemas.common import ErrorDetail, ErrorResponse
from keymouse_studio.config import Settings
from keymouse_studio.dependencies import require_session_token
from keymouse_studio.domain.errors import AppError, ErrorCode
from keymouse_studio.infrastructure.input.adapter import InputAdapter, InputWorker
from keymouse_studio.infrastructure.input.listener import (
    InputEventBridge,
    InputListener,
    PynputInputListener,
)
from keymouse_studio.infrastructure.input.send_input import SendInputAdapter
from keymouse_studio.infrastructure.persistence.json_script_repository import JsonScriptRepository
from keymouse_studio.infrastructure.persistence.json_settings_repository import (
    JsonSettingsRepository,
)
from keymouse_studio.infrastructure.system.capabilities import (
    CapabilityDetector,
    SystemCapabilityDetector,
)
from keymouse_studio.infrastructure.system.clock import MonotonicClock
from keymouse_studio.infrastructure.system.privilege import create_privilege_checker
from keymouse_studio.security import LoopbackCorsMiddleware
from keymouse_studio.services.automation_coordinator import AutomationCoordinator
from keymouse_studio.services.clicker_service import ClickerService
from keymouse_studio.services.event_service import EventService
from keymouse_studio.services.hotkey_service import HotkeyService
from keymouse_studio.services.operation_service import OperationService
from keymouse_studio.services.playback_service import PlaybackService
from keymouse_studio.services.recording_service import RecordingService
from keymouse_studio.services.script_service import ScriptService
from keymouse_studio.services.settings_service import SettingsService

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    bridge: InputEventBridge = app.state.input_bridge
    hotkey: HotkeyService = app.state.hotkey_service
    bridge_started = False
    hotkey_started = False
    try:
        await app.state.settings_service.load()
        hotkey_started = True
        await hotkey.start()
        await bridge.start()
        bridge_started = True
        yield
    finally:
        if hotkey_started:
            with suppress(Exception):
                await hotkey.stop()
        with suppress(Exception):
            await app.state.automation_coordinator.emergency_stop()
        with suppress(Exception):
            await app.state.recording_service.shutdown()
        with suppress(Exception):
            await app.state.playback_service.shutdown()
        with suppress(Exception):
            await app.state.clicker_service.shutdown()
        if bridge_started:
            with suppress(Exception):
                await bridge.stop()
        with suppress(Exception):
            app.state.input_worker.close()


def _error_response(detail: ErrorDetail, status_code: int) -> JSONResponse:
    response = ErrorResponse(error=detail)
    return JSONResponse(
        status_code=status_code,
        content=response.model_dump(mode="json", by_alias=True),
    )


def create_app(
    settings: Settings | None = None,
    input_adapter: InputAdapter | None = None,
    input_listener: InputListener | None = None,
    capability_detector: CapabilityDetector | None = None,
) -> FastAPI:
    app = FastAPI(
        title="KeyMouse Studio API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        separate_input_output_schemas=False,
    )
    app.add_middleware(LoopbackCorsMiddleware)
    app_settings = settings or Settings()
    event_service = EventService(app_settings.protocol_version)
    operation_service = OperationService(event_service)
    input_worker = InputWorker(input_adapter or SendInputAdapter())
    bridge = InputEventBridge(input_listener or PynputInputListener())
    script_service = ScriptService(JsonScriptRepository(app_settings.script_directory))
    clock = MonotonicClock()
    privilege_checker = create_privilege_checker()
    clicker_service = ClickerService(
        operation_service,
        input_worker,
        clock,
        privilege_checker=privilege_checker,
    )
    recording_service = RecordingService(operation_service, event_service, bridge)
    playback_service = PlaybackService(
        operation_service,
        script_service,
        input_worker,
        clock,
        privilege_checker=privilege_checker,
    )
    coordinator = AutomationCoordinator(
        operation_service,
        clicker_service,
        recording_service,
        playback_service,
        input_worker,
    )
    hotkey_service = HotkeyService(bridge, coordinator)
    settings_service = SettingsService(
        JsonSettingsRepository(app_settings.settings_file),
        hotkey_service,
    )
    clicker_service._settings_service = settings_service
    app.state.settings = app_settings
    app.state.event_service = event_service
    app.state.operation_service = operation_service
    app.state.input_worker = input_worker
    app.state.input_bridge = bridge
    app.state.clicker_service = clicker_service
    app.state.recording_service = recording_service
    app.state.playback_service = playback_service
    app.state.script_service = script_service
    app.state.automation_coordinator = coordinator
    app.state.hotkey_service = hotkey_service
    app.state.settings_service = settings_service
    app.state.capability_detector = capability_detector or SystemCapabilityDetector()

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
                message="请求参数校验失败",
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
        code = {
            404: ErrorCode.NOT_FOUND,
            405: ErrorCode.METHOD_NOT_ALLOWED,
        }.get(exc.status_code, ErrorCode.VALIDATION_ERROR)
        return _error_response(
            ErrorDetail(
                code=code,
                message=str(exc.detail),
            ),
            exc.status_code,
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        return _error_response(
            ErrorDetail(
                code=ErrorCode.ENGINE_INTERNAL_ERROR,
                message="引擎内部错误",
            ),
            500,
        )

    app.include_router(health.router, prefix=API_PREFIX)
    protected_dependencies = [Depends(require_session_token)]
    for api_router in (
        capabilities.router,
        operations.router,
        clicker.router,
        recording.router,
        playback.router,
        scripts.router,
        settings_router.router,
    ):
        app.include_router(api_router, prefix=API_PREFIX, dependencies=protected_dependencies)
    app.include_router(events.router, prefix=API_PREFIX)
    return app


app = create_app()
