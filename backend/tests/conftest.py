import os
import sys
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any, cast

import httpx
import pytest
from fastapi import FastAPI

from keymouse_studio.config import Settings
from keymouse_studio.infrastructure.input.adapter import FakeInputAdapter
from keymouse_studio.infrastructure.input.listener import FakeInputListener
from keymouse_studio.infrastructure.system.capabilities import (
    CapabilityCheck,
    CapabilitySnapshot,
    FakeCapabilityDetector,
)
from keymouse_studio.main import create_app

SESSION_TOKEN = "test-session-token"
ACKNOWLEDGEMENT = "I_UNDERSTAND"
ASGIApp = Any


def asgi_transport(app: FastAPI) -> httpx.ASGITransport:
    return httpx.ASGITransport(app=cast(ASGIApp, app))


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
    return Settings(
        session_token=SESSION_TOKEN,
        script_directory=tmp_path / "scripts",
        settings_file=tmp_path / "settings.json",
    )


@pytest.fixture
def capability_detector() -> FakeCapabilityDetector:
    available = CapabilityCheck("available")
    return FakeCapabilityDetector(
        CapabilitySnapshot(
            platform="windows",
            platform_version="10.0.test",
            input=available,
            global_hotkey=available,
            display=available,
            display_count=2,
            dpi_awareness=available,
        )
    )


@pytest.fixture
def app(settings: Settings, capability_detector: FakeCapabilityDetector) -> FastAPI:
    return create_app(
        settings,
        FakeInputAdapter(),
        FakeInputListener(),
        capability_detector,
    )


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = asgi_transport(app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {SESSION_TOKEN}"}
