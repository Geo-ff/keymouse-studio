import asyncio

from keymouse_studio.api.schemas.settings import (
    ApplicationSettings,
    HotkeyValidationResponse,
    normalize_hotkey,
)
from keymouse_studio.infrastructure.persistence.json_settings_repository import (
    JsonSettingsRepository,
)
from keymouse_studio.services.hotkey_service import HotkeyService


class SettingsService:
    def __init__(
        self,
        repository: JsonSettingsRepository,
        hotkeys: HotkeyService,
    ) -> None:
        self._repository = repository
        self._hotkeys = hotkeys
        self._lock = asyncio.Lock()
        self._settings = ApplicationSettings()
        self._loaded = False

    async def load(self) -> ApplicationSettings:
        async with self._lock:
            if not self._loaded:
                self._settings = await self._repository.load()
                self._hotkeys.configure(self._settings.emergency_stop_hotkey)
                self._loaded = True
            return self._settings

    async def get(self) -> ApplicationSettings:
        return await self.load()

    async def replace(self, settings: ApplicationSettings) -> ApplicationSettings:
        async with self._lock:
            saved = await self._repository.save(settings)
            self._hotkeys.configure(saved.emergency_stop_hotkey)
            self._settings = saved
            self._loaded = True
            return saved

    def validate_hotkey(self, hotkey: str) -> HotkeyValidationResponse:
        normalized = normalize_hotkey(hotkey)
        return HotkeyValidationResponse(
            normalized_hotkey=normalized,
            availability="unavailable",
            reason="Global hotkey occupancy cannot be reliably detected by the input listener",
        )