from typing import Annotated

from fastapi import APIRouter, Depends

from keymouse_studio.api.schemas.operations import StateSnapshot
from keymouse_studio.dependencies import get_operation_service
from keymouse_studio.services.operation_service import OperationService

router = APIRouter(tags=["operations"])


@router.get("/state", response_model=StateSnapshot)
async def state(
    service: Annotated[OperationService, Depends(get_operation_service)],
) -> StateSnapshot:
    return service.snapshot()
