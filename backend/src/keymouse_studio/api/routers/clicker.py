from typing import Annotated

from fastapi import APIRouter, Depends, status

from keymouse_studio.api.schemas.clicker import (
    ClickerConfig,
    OperationTransition,
    TimedClickConfig,
)
from keymouse_studio.dependencies import get_clicker_service
from keymouse_studio.services.clicker_service import ClickerService

router = APIRouter(tags=["clicker"])


@router.post(
    "/clicker/start",
    response_model=OperationTransition,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_clicker(
    config: ClickerConfig,
    service: Annotated[ClickerService, Depends(get_clicker_service)],
) -> OperationTransition:
    return await service.start_clicker(config)


@router.post(
    "/timed-click/start",
    response_model=OperationTransition,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_timed_click(
    config: TimedClickConfig,
    service: Annotated[ClickerService, Depends(get_clicker_service)],
) -> OperationTransition:
    return await service.start_timed_click(config)
