from typing import Annotated

from fastapi import APIRouter, Depends

from keymouse_studio.api.schemas.settings import (
    ApplicationSettings,
    ApplicationSettingsUpdate,
    HotkeyValidationRequest,
    HotkeyValidationResponse,
)
from keymouse_studio.dependencies import get_settings_service
from keymouse_studio.services.settings_service import SettingsService

router = APIRouter(tags=["settings"])


@router.get("/settings", response_model=ApplicationSettings)
async def get_application_settings(
    service: Annotated[SettingsService, Depends(get_settings_service)],
) -> ApplicationSettings:
    return await service.get()


@router.put("/settings", response_model=ApplicationSettings)
async def replace_application_settings(
    request: ApplicationSettingsUpdate,
    service: Annotated[SettingsService, Depends(get_settings_service)],
) -> ApplicationSettings:
    return await service.replace(request.to_settings())


@router.post("/hotkeys/validate", response_model=HotkeyValidationResponse)
async def validate_hotkey(
    request: HotkeyValidationRequest,
    service: Annotated[SettingsService, Depends(get_settings_service)],
) -> HotkeyValidationResponse:
    return service.validate_hotkey(request.hotkey)