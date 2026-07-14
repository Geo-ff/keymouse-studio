import asyncio

import pytest

from keymouse_studio.services.event_service import EventService


@pytest.mark.asyncio
async def test_event_subscriber_receives_created_events() -> None:
    service = EventService(protocol_version=1)
    queue = service.subscribe()

    created = await service.create("operation.progress", {"completedCount": 1})
    received = await asyncio.wait_for(queue.get(), timeout=0.1)

    assert received == created
    service.unsubscribe(queue)


@pytest.mark.asyncio
async def test_slow_event_subscriber_drops_oldest_event() -> None:
    service = EventService(protocol_version=1, subscriber_capacity=1)
    queue = service.subscribe()

    await service.create("first", {})
    latest = await service.create("second", {})

    assert await asyncio.wait_for(queue.get(), timeout=0.1) == latest
