from dataclasses import dataclass, field
from ipaddress import ip_address
from pathlib import Path
from secrets import token_urlsafe


@dataclass(frozen=True, slots=True)
class Settings:
    host: str = "127.0.0.1"
    port: int = 0
    app_version: str = "0.1.0"
    protocol_version: int = 1
    script_directory: Path = field(
        default_factory=lambda: Path.home() / ".keymouse-studio" / "scripts"
    )
    settings_file: Path = field(
        default_factory=lambda: Path.home() / ".keymouse-studio" / "settings.json"
    )
    session_token: str = field(default_factory=lambda: token_urlsafe(32), repr=False)

    def __post_init__(self) -> None:
        ip_address(self.host)
        if not 0 <= self.port <= 65535:
            raise ValueError("port must be between 0 and 65535")
        if not self.session_token:
            raise ValueError("session_token must not be empty")
