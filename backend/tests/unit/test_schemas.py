from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import TypeAdapter, ValidationError

from keymouse_studio.api.schemas.actions import ScriptAction
from keymouse_studio.api.schemas.scripts import Script

adapter: TypeAdapter[ScriptAction] = TypeAdapter(ScriptAction)


@pytest.mark.parametrize(
    ("action_type", "payload"),
    [
        ("mouse_move", {"x": 1, "y": 2, "durationMs": 10}),
        ("mouse_button_down", {"button": "left"}),
        ("mouse_button_up", {"button": "right"}),
        ("mouse_click", {"button": "middle", "clickCount": 2, "intervalMs": 50}),
        ("mouse_wheel", {"deltaX": 0, "deltaY": -120}),
        ("key_down", {"keyCode": "VK_A", "scanCode": 30, "extended": False}),
        ("key_up", {"keyCode": "VK_A"}),
        ("wait", {"durationMs": 1000}),
    ],
)
def test_all_action_types_validate(action_type: str, payload: dict[str, object]) -> None:
    action = adapter.validate_python({"id": str(uuid4()), "type": action_type, "payload": payload})
    assert action.type == action_type


def test_unknown_action_is_rejected() -> None:
    with pytest.raises(ValidationError):
        adapter.validate_python({"id": str(uuid4()), "type": "unknown", "payload": {}})


def test_mouse_click_coordinates_must_be_paired() -> None:
    with pytest.raises(ValidationError):
        adapter.validate_python(
            {"id": str(uuid4()), "type": "mouse_click", "payload": {"button": "left", "x": 1}}
        )


def test_script_rejects_unknown_fields_and_naive_timestamps() -> None:
    now = datetime.now(UTC)
    base = {
        "schemaVersion": 1,
        "id": str(uuid4()),
        "name": "test",
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat(),
        "actions": [],
    }
    with pytest.raises(ValidationError):
        Script.model_validate({**base, "unexpected": True})
    with pytest.raises(ValidationError):
        Script.model_validate({**base, "createdAt": "2026-07-14T08:00:00"})
