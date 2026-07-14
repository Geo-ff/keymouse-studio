from fastapi import APIRouter

from keymouse_studio.api.schemas.common import StateSnapshot

router = APIRouter(tags=["operations"])


@router.get("/state", response_model=StateSnapshot)
async def state() -> StateSnapshot:
    return StateSnapshot()
