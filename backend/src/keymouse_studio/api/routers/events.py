import asyncio
from contextlib import suppress
from secrets import compare_digest

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from keymouse_studio.config import Settings
from keymouse_studio.services.event_service import EventService
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
    operations: OperationService = websocket.app.state.operation_service
    event_service: EventService = websocket.app.state.event_service
    queue = event_service.subscribe()
    try:
        await operations.snapshot_event()
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
