import asyncio

from keymouse_studio.infrastructure.input.listener import InputEventBridge, RawInputEvent
from keymouse_studio.services.automation_coordinator import AutomationCoordinator


class HotkeyService:
    def __init__(self, bridge: InputEventBridge, coordinator: AutomationCoordinator) -> None:
        self._bridge = bridge
        self._coordinator = coordinator
        self._task: asyncio.Task[None] | None = None
        self._ready = asyncio.Event()

    async def start(self) -> None:
        if self._task is None:
            self._ready.clear()
            self._task = asyncio.create_task(self._run(), name="f12-emergency-stop")
            await self._ready.wait()

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def handle(self, event: RawInputEvent) -> bool:
        if event.type == "key_down" and event.key_code is not None:
            if event.key_code.lower() == "f12":
                await self._coordinator.emergency_stop()
                return True
        return False

    async def _run(self) -> None:
        subscriber = self._bridge.subscribe()
        self._ready.set()
        try:
            while True:
                event = await subscriber.get()
                if event is None:
                    return
                if isinstance(event, RawInputEvent):
                    await self.handle(event)
        finally:
            self._bridge.unsubscribe(subscriber)
