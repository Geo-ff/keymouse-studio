from typing import Annotated

from fastapi import APIRouter, Depends

from keymouse_studio.api.schemas.common import CapabilitiesResponse, CapabilityStatus
from keymouse_studio.dependencies import get_capability_detector
from keymouse_studio.infrastructure.system.capabilities import CapabilityDetector

router = APIRouter(tags=["capabilities"])


@router.get("/capabilities", response_model=CapabilitiesResponse)
async def capabilities(
    detector: Annotated[CapabilityDetector, Depends(get_capability_detector)],
) -> CapabilitiesResponse:
    snapshot = detector.detect()
    return CapabilitiesResponse(
        platform=snapshot.platform,
        platform_version=snapshot.platform_version,
        input=CapabilityStatus(status=snapshot.input.status, reason=snapshot.input.reason),
        global_hotkey=CapabilityStatus(
            status=snapshot.global_hotkey.status,
            reason=snapshot.global_hotkey.reason,
        ),
        display=CapabilityStatus(status=snapshot.display.status, reason=snapshot.display.reason),
        display_count=snapshot.display_count,
        dpi_awareness=CapabilityStatus(
            status=snapshot.dpi_awareness.status,
            reason=snapshot.dpi_awareness.reason,
        ),
    )
