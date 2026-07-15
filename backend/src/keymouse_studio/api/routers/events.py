import asyncio
from contextlib import suppress
from secrets import compare_digest

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from keymouse_studio.config import Settings
from keymouse_studio.security import is_allowed_browser_origin, is_loopback_host
from keymouse_studio.services.event_service import EventService
from keymouse_studio.services.operation_service import OperationService

router = APIRouter(tags=["events"])


@router.websocket("/events")
async def events(websocket: WebSocket) -> None:
    settings: Settings = websocket.app.state.settings
    if not is_allowed_browser_origin(websocket.headers.get("origin")):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Origin not allowed")
        return
    scheme, _, authorization_token = (websocket.headers.get("authorization") or "").partition(
        " "
    )
    authorized = scheme.lower() == "bearer" and compare_digest(
        authorization_token, settings.session_token
    )
    query_token = websocket.query_params.get("token")
    client_host = websocket.client.host if websocket.client is not None else None
    if (
        not authorized
        and query_token is not None
        and is_loopback_host(client_host)
        and is_loopback_host(settings.host)
    ):
        authorized = compare_digest(query_token, settings.session_token)
    if not authorized:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized")
        return

    await websocket.accept()
    operations: OperationService = websocket.app.state.operation_service
    event_service: EventService = websocket.app.state.event_service
    queue = event_service.subscribe()
    try:
        snapshot = await operations.snapshot_event()
        await websocket.send_json(snapshot.model_dump(mode="json", by_alias=True))
        while True:
            receive_task = asyncio.create_task(websocket.receive())
            event_task = asyncio.create_task(queue.get())
            done, pending = await asyncio.wait(
                {receive_task, event_task}, return_when=asyncio.FIRST_COMPLETED
            )
            for task in pending:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
            if receive_task in done:
                message = receive_task.result()
                if message["type"] == "websocket.disconnect":
                    break
            if event_task in done:
                event = event_task.result()
                await websocket.send_json(event.model_dump(mode="json", by_alias=True))
    except WebSocketDisconnect:
        pass
    finally:
        event_service.unsubscribe(queue)
