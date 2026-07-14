from typing import Annotated

from fastapi import APIRouter, Depends

from keymouse_studio.api.schemas.common import HealthResponse
from keymouse_studio.config import Settings
from keymouse_studio.dependencies import get_settings

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(settings: Annotated[Settings, Depends(get_settings)]) -> HealthResponse:
    return HealthResponse(
        app_version=settings.app_version,
        protocol_version=settings.protocol_version,
    )
