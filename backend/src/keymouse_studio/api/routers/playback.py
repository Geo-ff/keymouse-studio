from typing import Annotated

from fastapi import APIRouter, Depends, status

from keymouse_studio.api.schemas.operations import OperationTransition
from keymouse_studio.api.schemas.playback import PlaybackRequest
from keymouse_studio.dependencies import get_playback_service
from keymouse_studio.services.playback_service import PlaybackService

router = APIRouter(prefix="/playback", tags=["playback"])


@router.post(
    "/start",
    response_model=OperationTransition,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_playback(
    request: PlaybackRequest,
    service: Annotated[PlaybackService, Depends(get_playback_service)],
) -> OperationTransition:
    return await service.start(request)
