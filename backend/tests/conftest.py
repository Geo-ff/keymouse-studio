from collections.abc import AsyncIterator

import httpx
import pytest
from fastapi import FastAPI

from keymouse_studio.config import Settings
from keymouse_studio.main import create_app

SESSION_TOKEN = "test-session-token"


@pytest.fixture
def settings() -> Settings:
    return Settings(session_token=SESSION_TOKEN)


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
