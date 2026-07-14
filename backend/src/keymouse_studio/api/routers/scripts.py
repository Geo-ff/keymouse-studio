from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from keymouse_studio.api.schemas.scripts import (
    Script,
    ScriptCreate,
    ScriptUpdate,
    ScriptValidationRequest,
    ScriptValidationResponse,
)
from keymouse_studio.dependencies import get_script_service
from keymouse_studio.services.script_service import ScriptService

router = APIRouter(prefix="/scripts", tags=["scripts"])


@router.post("/validate", response_model=ScriptValidationResponse)
async def validate_script(
    request: ScriptValidationRequest,
    service: Annotated[ScriptService, Depends(get_script_service)],
) -> ScriptValidationResponse:
    return ScriptValidationResponse(script=service.validate(request.script))


@router.post("", response_model=Script, status_code=status.HTTP_201_CREATED)
async def create_script(
    request: ScriptCreate,
    service: Annotated[ScriptService, Depends(get_script_service)],
) -> Script:
    return await service.create(request)


@router.get("", response_model=list[Script])
async def list_scripts(
    service: Annotated[ScriptService, Depends(get_script_service)],
) -> list[Script]:
    return await service.list()


@router.get("/{script_id}", response_model=Script)
async def get_script(
    script_id: UUID,
    service: Annotated[ScriptService, Depends(get_script_service)],
) -> Script:
    return await service.get(script_id)


@router.put("/{script_id}", response_model=Script)
async def replace_script(
    script_id: UUID,
    request: ScriptUpdate,
    service: Annotated[ScriptService, Depends(get_script_service)],
) -> Script:
    return await service.replace(script_id, request)


@router.post("/{script_id}/duplicate", response_model=Script, status_code=status.HTTP_201_CREATED)
async def duplicate_script(
    script_id: UUID,
    service: Annotated[ScriptService, Depends(get_script_service)],
) -> Script:
    return await service.duplicate(script_id)


@router.delete("/{script_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_script(
    script_id: UUID,
    service: Annotated[ScriptService, Depends(get_script_service)],
) -> Response:
    await service.delete(script_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
