import asyncio

from keymouse_studio.api.schemas.settings import normalize_hotkey
from keymouse_studio.infrastructure.input.listener import InputEventBridge, RawInputEvent
from keymouse_studio.services.automation_coordinator import AutomationCoordinator

_MODIFIERS = {
    "alt": "alt",
    "alt_l": "alt",
    "alt_r": "alt",
    "ctrl": "ctrl",
    "ctrl_l": "ctrl",
    "ctrl_r": "ctrl",
    "shift": "shift",
    "shift_l": "shift",
    "shift_r": "shift",
    "cmd": "win",
    "cmd_l": "win",
    "cmd_r": "win",
    "win": "win",
}


class HotkeyService:
    def __init__(self, bridge: InputEventBridge, coordinator: AutomationCoordinator) -> None:
        self._bridge = bridge
        self._coordinator = coordinator
        self._task: asyncio.Task[None] | None = None
        self._ready = asyncio.Event()
        self._modifiers: set[str] = set()
        self._pressed: set[str] = set()
        self._hotkey = "f12"
        self._hotkey_modifiers: set[str] = set()
        self._hotkey_key = "f12"

    def configure(self, hotkey: str) -> None:
        normalized = normalize_hotkey(hotkey)
        parts = normalized.split("+")
        self._hotkey = normalized
        self._hotkey_modifiers = set(parts[:-1])
        self._hotkey_key = parts[-1]
        self._pressed.clear()

    @property
    def hotkey(self) -> str:
        return self._hotkey

    async def start(self) -> None:
        if self._task is None:
            self._ready.clear()
            self._task = asyncio.create_task(self._run(), name="emergency-stop-hotkey")
            await self._ready.wait()

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
            self._modifiers.clear()
            self._pressed.clear()

    async def handle(self, event: RawInputEvent) -> bool:
        if event.type not in {"key_down", "key_up"} or event.key_code is None:
            return False
        key = event.key_code.lower()
        modifier = _MODIFIERS.get(key)
        if event.type == "key_up":
            if modifier is not None:
                self._modifiers.discard(modifier)
            self._pressed.discard(key)
            return False
        if modifier is not None:
            self._modifiers.add(modifier)
        if key in self._pressed:
            return False
        self._pressed.add(key)
        if key == self._hotkey_key and self._modifiers == self._hotkey_modifiers:
            await self._coordinator.emergency_stop()
            return True
        return False

    async def _run(self) -> None:
        subscriber = self._bridge.subscribe()
        self._ready.set()
        try:
            while True:
                # Drain keyboard events preferentially; skip mouse flood so F12 stays responsive
                # while clicker/playback injects high-frequency mouse events.
                event = await self._next_keyboard_event(subscriber)
                if event is None:
                    return
                await self.handle(event)
        finally:
            self._bridge.unsubscribe(subscriber)

    async def _next_keyboard_event(self, subscriber: object) -> RawInputEvent | None:
        from keymouse_studio.infrastructure.input.listener import SubscriptionBarrier

        while True:
            event = await subscriber.get()  # type: ignore[attr-defined]
            if event is None:
                return None
            if isinstance(event, SubscriptionBarrier):
                if not event.reached.done():
                    event.reached.set_result(None)
                continue
            if not isinstance(event, RawInputEvent):
                continue
            if event.type in {"key_down", "key_up"}:
                return event
            # Drop mouse_move / mouse_button / wheel — they must not block emergency stop.
