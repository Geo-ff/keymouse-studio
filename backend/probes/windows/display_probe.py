from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass

ABSOLUTE_COORDINATE_MAX = 65_535


@dataclass(frozen=True, slots=True)
class VirtualBounds:
    left: int
    top: int
    width: int
    height: int

    def __post_init__(self) -> None:
        if self.width <= 1 or self.height <= 1:
            raise ValueError("virtual desktop dimensions must be greater than one pixel")


@dataclass(frozen=True, slots=True)
class Display:
    device_name: str
    left: int
    top: int
    width: int
    height: int
    primary: bool


def normalize_absolute_coordinate(x: int, y: int, bounds: VirtualBounds) -> tuple[int, int]:
    if not bounds.left <= x < bounds.left + bounds.width:
        raise ValueError("x is outside the virtual desktop")
    if not bounds.top <= y < bounds.top + bounds.height:
        raise ValueError("y is outside the virtual desktop")
    normalized_x = round((x - bounds.left) * ABSOLUTE_COORDINATE_MAX / (bounds.width - 1))
    normalized_y = round((y - bounds.top) * ABSOLUTE_COORDINATE_MAX / (bounds.height - 1))
    return normalized_x, normalized_y


def layout_digest(displays: list[Display]) -> str:
    canonical = sorted(
        (asdict(display) for display in displays),
        key=lambda item: item["device_name"],
    )
    payload = json.dumps(canonical, ensure_ascii=True, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()