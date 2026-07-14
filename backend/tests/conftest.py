import os
import sys
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI

from keymouse_studio.config import Settings
from keymouse_studio.main import create_app

SESSION_TOKEN = "test-session-token"
ACKNOWLEDGEMENT = "I_UNDERSTAND"


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption("--run-windows-probes", action="store_true", default=False)
    parser.addoption("--allow-real-input", action="store_true", default=False)


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    for item in items:
        if "windows_probe" in item.keywords and (
            sys.platform != "win32" or not config.getoption("--run-windows-probes")
        ):
            item.add_marker(pytest.mark.skip(reason="Windows probes require explicit opt-in"))
        if "real_input" in item.keywords and (
            not config.getoption("--allow-real-input")
            or os.environ.get("KEYMOUSE_REAL_INPUT_ACK") != ACKNOWLEDGEMENT
        ):
            item.add_marker(pytest.mark.skip(reason="Real input requires explicit acknowledgement"))


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(session_token=SESSION_TOKEN, script_directory=tmp_path / "scripts")


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {SESSION_TOKEN}"}
