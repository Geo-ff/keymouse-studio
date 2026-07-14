from fastapi import APIRouter

from keymouse_studio.api.schemas.common import CapabilitiesResponse

router = APIRouter(tags=["capabilities"])


@router.get("/capabilities", response_model=CapabilitiesResponse)
async def capabilities() -> CapabilitiesResponse:
    return CapabilitiesResponse()
