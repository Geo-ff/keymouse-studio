from secrets import compare_digest

from fastapi import APIRouter, WebSocket, status

from keymouse_studio.config import Settings
from keymouse_studio.services.operation_service import OperationService

router = APIRouter(tags=["events"])


@router.websocket("/events")
async def events(websocket: WebSocket) -> None:
    settings: Settings = websocket.app.state.settings
    scheme, _, token = (websocket.headers.get("authorization") or "").partition(" ")
    if scheme.lower() != "bearer" or not compare_digest(token, settings.session_token):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized")
        return

    await websocket.accept()
    service: OperationService = websocket.app.state.operation_service
    event = await service.snapshot_event()
    await websocket.send_json(event.model_dump(mode="json", by_alias=True))
    await websocket.close(code=status.WS_1000_NORMAL_CLOSURE)
