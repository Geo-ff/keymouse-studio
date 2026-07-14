from secrets import compare_digest

from fastapi import APIRouter, WebSocket, status

from keymouse_studio.api.schemas.common import StateEvent, StateSnapshot
from keymouse_studio.config import Settings

router = APIRouter(tags=["events"])


@router.websocket("/events")
async def events(websocket: WebSocket) -> None:
    settings: Settings = websocket.app.state.settings
    scheme, _, token = (websocket.headers.get("authorization") or "").partition(" ")
    if scheme.lower() != "bearer" or not compare_digest(token, settings.session_token):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized")
        return

    await websocket.accept()
    event = StateEvent(
        protocol_version=settings.protocol_version,
        payload=StateSnapshot(),
    )
    await websocket.send_json(event.model_dump(mode="json", by_alias=True))
    await websocket.close(code=status.WS_1000_NORMAL_CLOSURE)
