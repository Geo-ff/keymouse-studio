from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from keymouse_studio.api.schemas.clicker import EmergencyStopResponse
from keymouse_studio.api.schemas.operations import OperationTransition, StateSnapshot
from keymouse_studio.api.schemas.recording import RecordingStopResponse
from keymouse_studio.dependencies import get_automation_coordinator, get_operation_service
from keymouse_studio.services.automation_coordinator import AutomationCoordinator
from keymouse_studio.services.operation_service import OperationService

router = APIRouter(tags=["operations"])


@router.get("/state", response_model=StateSnapshot)
async def state(
    service: Annotated[OperationService, Depends(get_operation_service)],
) -> StateSnapshot:
    return service.snapshot()


@router.post("/operations/{operation_id}/pause", response_model=OperationTransition)
async def pause(
    operation_id: UUID,
    service: Annotated[AutomationCoordinator, Depends(get_automation_coordinator)],
) -> OperationTransition:
    return await service.pause(operation_id)


@router.post("/operations/{operation_id}/resume", response_model=OperationTransition)
async def resume(
    operation_id: UUID,
    service: Annotated[AutomationCoordinator, Depends(get_automation_coordinator)],
) -> OperationTransition:
    return await service.resume(operation_id)


@router.post(
    "/operations/{operation_id}/stop",
    response_model=OperationTransition | RecordingStopResponse,
)
async def stop(
    operation_id: UUID,
    service: Annotated[AutomationCoordinator, Depends(get_automation_coordinator)],
) -> OperationTransition | RecordingStopResponse:
    return await service.stop(operation_id)


@router.post("/emergency-stop", response_model=EmergencyStopResponse)
async def emergency_stop(
    service: Annotated[AutomationCoordinator, Depends(get_automation_coordinator)],
) -> EmergencyStopResponse:
    return await service.emergency_stop()
