from secrets import compare_digest
from typing import Annotated, cast

from fastapi import Depends, Header, Request

from keymouse_studio.config import Settings
from keymouse_studio.domain.errors import UnauthorizedError
from keymouse_studio.infrastructure.system.capabilities import CapabilityDetector
from keymouse_studio.services.automation_coordinator import AutomationCoordinator
from keymouse_studio.services.clicker_service import ClickerService
from keymouse_studio.services.operation_service import OperationService
from keymouse_studio.services.playback_service import PlaybackService
from keymouse_studio.services.recording_service import RecordingService
from keymouse_studio.services.script_service import ScriptService
from keymouse_studio.services.settings_service import SettingsService


def get_settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


def get_operation_service(request: Request) -> OperationService:
    return cast(OperationService, request.app.state.operation_service)


def get_clicker_service(request: Request) -> ClickerService:
    return cast(ClickerService, request.app.state.clicker_service)


def get_script_service(request: Request) -> ScriptService:
    return cast(ScriptService, request.app.state.script_service)


def get_recording_service(request: Request) -> RecordingService:
    return cast(RecordingService, request.app.state.recording_service)


def get_playback_service(request: Request) -> PlaybackService:
    return cast(PlaybackService, request.app.state.playback_service)


def get_automation_coordinator(request: Request) -> AutomationCoordinator:
    return cast(AutomationCoordinator, request.app.state.automation_coordinator)


def get_settings_service(request: Request) -> SettingsService:
    return cast(SettingsService, request.app.state.settings_service)


def get_capability_detector(request: Request) -> CapabilityDetector:
    return cast(CapabilityDetector, request.app.state.capability_detector)


def require_session_token(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not compare_digest(token, settings.session_token):
        raise UnauthorizedError
