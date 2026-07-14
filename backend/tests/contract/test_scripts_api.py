from copy import deepcopy
from uuid import UUID

import httpx
import pytest
from fastapi import FastAPI


@pytest.fixture
def script_create_payload() -> dict[str, object]:
    return {
        "name": "示例脚本",
        "description": "contract test",
        "settings": {
            "speedMultiplier": 1.5,
            "loopMode": "count",
            "loopCount": 2,
            "countdownMs": 500,
        },
        "actions": [],
    }


@pytest.mark.asyncio
async def test_scripts_crud_contract(
    client: httpx.AsyncClient,
    auth_headers: dict[str, str],
    script_create_payload: dict[str, object],
) -> None:
    create_response = await client.post(
        "/api/v1/scripts", headers=auth_headers, json=script_create_payload
    )
    assert create_response.status_code == 201
    created = create_response.json()
    script_id = UUID(created["id"])
    assert created["schemaVersion"] == 1
    assert created["name"] == "示例脚本"
    assert created["createdAt"].endswith("Z")

    list_response = await client.get("/api/v1/scripts", headers=auth_headers)
    assert list_response.status_code == 200
    assert list_response.json() == [created]

    created["name"] = "已更新"
    update_response = await client.put(
        f"/api/v1/scripts/{script_id}", headers=auth_headers, json=created
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["name"] == "已更新"
    assert updated["createdAt"] == created["createdAt"]

    duplicate_response = await client.post(
        f"/api/v1/scripts/{script_id}/duplicate", headers=auth_headers
    )
    assert duplicate_response.status_code == 201
    assert duplicate_response.json()["id"] != str(script_id)

    delete_response = await client.delete(f"/api/v1/scripts/{script_id}", headers=auth_headers)
    assert delete_response.status_code == 204
    missing_response = await client.get(f"/api/v1/scripts/{script_id}", headers=auth_headers)
    assert missing_response.status_code == 404
    assert missing_response.json()["error"]["code"] == "SCRIPT_NOT_FOUND"


@pytest.mark.asyncio
async def test_script_validation_contract(
    client: httpx.AsyncClient,
    auth_headers: dict[str, str],
    script_create_payload: dict[str, object],
) -> None:
    created = (
        await client.post("/api/v1/scripts", headers=auth_headers, json=script_create_payload)
    ).json()
    valid_response = await client.post(
        "/api/v1/scripts/validate", headers=auth_headers, json={"script": created}
    )
    assert valid_response.status_code == 200
    assert valid_response.json() == {"valid": True, "script": created}

    future = deepcopy(created)
    future["schemaVersion"] = 2
    invalid_response = await client.post(
        "/api/v1/scripts/validate", headers=auth_headers, json={"script": future}
    )
    assert invalid_response.status_code == 422
    assert invalid_response.json()["error"]["code"] == "SCRIPT_VERSION_UNSUPPORTED"


def test_openapi_uses_action_discriminator(app: FastAPI) -> None:
    schema = app.openapi()
    script_schema = schema["components"]["schemas"]["Script"]
    actions_schema = script_schema["properties"]["actions"]["items"]
    assert actions_schema["discriminator"]["propertyName"] == "type"
    assert len(actions_schema["oneOf"]) == 8


@pytest.mark.asyncio
async def test_request_validation_error_is_serializable(
    client: httpx.AsyncClient, auth_headers: dict[str, str]
) -> None:
    response = await client.post(
        "/api/v1/scripts",
        headers=auth_headers,
        json={"name": "invalid", "settings": {"speedMultiplier": 0}},
    )
    assert response.status_code == 422
    errors = response.json()["error"]["details"]["errors"]
    assert errors[0].keys() == {"path", "type", "message"}


@pytest.mark.asyncio
async def test_script_routes_require_authentication(
    client: httpx.AsyncClient, script_create_payload: dict[str, object]
) -> None:
    response = await client.post("/api/v1/scripts", json=script_create_payload)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED_LOCAL_CLIENT"
