from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, model_validator

from keymouse_studio.api.schemas.common import ApiModel
from keymouse_studio.domain.enums import MouseButton

NonNegativeInt = Annotated[int, Field(ge=0)]
Coordinate = Annotated[int, Field(ge=-2147483648, le=2147483647)]


class MouseMovePayload(ApiModel):
    x: Coordinate
    y: Coordinate
    duration_ms: NonNegativeInt = 0


class MouseButtonPayload(ApiModel):
    button: MouseButton


class MouseClickPayload(ApiModel):
    button: MouseButton
    click_count: Literal[1, 2] = 1
    x: Coordinate | None = None
    y: Coordinate | None = None
    interval_ms: NonNegativeInt = 0

    @model_validator(mode="after")
    def validate_coordinates(self) -> "MouseClickPayload":
        if (self.x is None) != (self.y is None):
            raise ValueError("x and y must be provided together")
        return self


class MouseWheelPayload(ApiModel):
    delta_x: int = 0
    delta_y: int


class KeyPayload(ApiModel):
    key_code: Annotated[str, Field(min_length=1, max_length=64)]
    scan_code: NonNegativeInt | None = None
    extended: bool = False


class WaitPayload(ApiModel):
    duration_ms: Annotated[int, Field(ge=0, le=86_400_000)]


class ActionBase(ApiModel):
    id: UUID
    enabled: bool = True
    delay_before_ms: NonNegativeInt = 0


class MouseMoveAction(ActionBase):
    type: Literal["mouse_move"]
    payload: MouseMovePayload


class MouseButtonDownAction(ActionBase):
    type: Literal["mouse_button_down"]
    payload: MouseButtonPayload


class MouseButtonUpAction(ActionBase):
    type: Literal["mouse_button_up"]
    payload: MouseButtonPayload


class MouseClickAction(ActionBase):
    type: Literal["mouse_click"]
    payload: MouseClickPayload


class MouseWheelAction(ActionBase):
    type: Literal["mouse_wheel"]
    payload: MouseWheelPayload


class KeyDownAction(ActionBase):
    type: Literal["key_down"]
    payload: KeyPayload


class KeyUpAction(ActionBase):
    type: Literal["key_up"]
    payload: KeyPayload


class WaitAction(ActionBase):
    type: Literal["wait"]
    payload: WaitPayload


ScriptAction = Annotated[
    MouseMoveAction
    | MouseButtonDownAction
    | MouseButtonUpAction
    | MouseClickAction
    | MouseWheelAction
    | KeyDownAction
    | KeyUpAction
    | WaitAction,
    Field(discriminator="type"),
]
