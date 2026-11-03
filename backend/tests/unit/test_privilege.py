from keymouse_studio.infrastructure.system.privilege import (
    IntegrityLevel,
    can_inject,
    integrity_level_from_rid,
)


def test_integrity_level_from_rid() -> None:
    assert integrity_level_from_rid(0x1000) is IntegrityLevel.LOW
    assert integrity_level_from_rid(0x2000) is IntegrityLevel.MEDIUM
    assert integrity_level_from_rid(0x3000) is IntegrityLevel.HIGH
    assert integrity_level_from_rid(0x4000) is IntegrityLevel.SYSTEM


def test_can_inject_rejects_upward_integrity() -> None:
    assert can_inject(IntegrityLevel.MEDIUM, IntegrityLevel.MEDIUM)
    assert can_inject(IntegrityLevel.HIGH, IntegrityLevel.MEDIUM)
    assert not can_inject(IntegrityLevel.MEDIUM, IntegrityLevel.HIGH)
    assert not can_inject(IntegrityLevel.UNKNOWN, IntegrityLevel.MEDIUM)
    assert not can_inject(IntegrityLevel.MEDIUM, IntegrityLevel.UNKNOWN)

def test_elevated_process_can_inject_into_unreadable_target() -> None:
    # Games protected by anti-cheat often refuse handle queries; running KeyMouse Studio as
    # administrator must then actually unblock injection instead of failing the same way.
    assert can_inject(IntegrityLevel.HIGH, IntegrityLevel.UNKNOWN)
    assert can_inject(IntegrityLevel.SYSTEM, IntegrityLevel.UNKNOWN)
    assert not can_inject(IntegrityLevel.LOW, IntegrityLevel.UNKNOWN)
    assert not can_inject(IntegrityLevel.UNKNOWN, IntegrityLevel.UNKNOWN)
