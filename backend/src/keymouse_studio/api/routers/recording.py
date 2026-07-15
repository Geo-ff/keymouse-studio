from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from keymouse_studio.api.schemas.operations import OperationTransition
from keymouse_studio.api.schemas.recording import RecordingConfig, RecordingResult
from keymouse_studio.dependencies import get_recording_service
from keymouse_studio.services.recording_service import RecordingService

router = APIRouter(prefix="/recordings", tags=["recording"])


@router.post(
    "/start",
    response_model=OperationTransition,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_recording(
    config: RecordingConfig,
    service: Annotated[RecordingService, Depends(get_recording_service)],
) -> OperationTransition:
    return await service.start(config)


@router.get("/{recording_id}", response_model=RecordingResult)
async def get_recording(
    recording_id: UUID,
    service: Annotated[RecordingService, Depends(get_recording_service)],
) -> RecordingResult:
    return await service.get(recording_id)
