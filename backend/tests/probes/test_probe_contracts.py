from __future__ import annotations

import ctypes

import pytest

from probes.windows.display_probe import (
    Display,
    VirtualBounds,
    layout_digest,
    normalize_absolute_coordinate,
)
from probes.windows.hotkey_probe import InputRegistry, latency_ms
from probes.windows.privilege_probe import (
    IntegrityLevel,
    can_inject,
    integrity_level_from_rid,
)
from probes.windows.send_input_probe import INPUT, KEYBDINPUT, MOUSEINPUT
from probes.windows.timing_probe import PausableDeadline


def test_pause_preserves_remaining_wait() -> None:
    deadline = PausableDeadline.start(5_000, 0)
    deadline.pause(2_000_000_000)
    assert deadline.remaining_ms(10_000_000_000) == 3_000
    deadline.resume(10_000_000_000)
    assert deadline.remaining_ms(12_000_000_000) == 1_000
    assert deadline.remaining_ms(13_000_000_000) == 0


def test_virtual_desktop_coordinates_include_negative_origins() -> None:
    bounds = VirtualBounds(left=-1920, top=0, width=3840, height=1080)
    assert normalize_absolute_coordinate(-1920, 0, bounds) == (0, 0)
    assert normalize_absolute_coordinate(1919, 1079, bounds) == (65_535, 65_535)
    with pytest.raises(ValueError):
        normalize_absolute_coordinate(1920, 0, bounds)


def test_layout_digest_is_stable_and_detects_changes() -> None:
    left = Display("LEFT", -1920, 0, 1920, 1080, False)
    main = Display("MAIN", 0, 0, 1920, 1080, True)
    assert layout_digest([left, main]) == layout_digest([main, left])
    assert layout_digest([left, main]) != layout_digest([main])


def test_integrity_boundary_does_not_allow_upward_injection() -> None:
    assert integrity_level_from_rid(0x2000) is IntegrityLevel.MEDIUM
    assert integrity_level_from_rid(0x3000) is IntegrityLevel.HIGH
    assert not can_inject(IntegrityLevel.MEDIUM, IntegrityLevel.HIGH)
    assert can_inject(IntegrityLevel.HIGH, IntegrityLevel.MEDIUM)


def test_registry_releases_every_input_even_after_failure() -> None:
    registry = InputRegistry(keys={65, 66}, buttons={"left"})
    released: list[str] = []

    def release_key(key: int) -> None:
        released.append(f"key:{key}")
        if key == 65:
            raise OSError

    failures = registry.release_all(release_key, lambda button: released.append(f"button:{button}"))
    assert failures == ["key:65"]
    assert set(released) == {"key:65", "key:66", "button:left"}
    assert not registry.keys
    assert not registry.buttons


def test_hotkey_latency_target() -> None:
    assert latency_ms(1_000_000_000, 1_049_000_000) == 49
    with pytest.raises(ValueError):
        latency_ms(2, 1)


def test_send_input_structures_have_windows_compatible_layout() -> None:
    assert ctypes.sizeof(KEYBDINPUT) in (16, 24)
    assert ctypes.sizeof(MOUSEINPUT) in (24, 32)
    assert ctypes.sizeof(INPUT) in (28, 40)