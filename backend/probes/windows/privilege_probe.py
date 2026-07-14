from __future__ import annotations

from enum import StrEnum


class IntegrityLevel(StrEnum):
    UNKNOWN = "unknown"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    SYSTEM = "system"


def integrity_level_from_rid(rid: int) -> IntegrityLevel:
    if rid >= 0x4000:
        return IntegrityLevel.SYSTEM
    if rid >= 0x3000:
        return IntegrityLevel.HIGH
    if rid >= 0x2000:
        return IntegrityLevel.MEDIUM
    if rid >= 0x1000:
        return IntegrityLevel.LOW
    return IntegrityLevel.UNKNOWN


def can_inject(current: IntegrityLevel, target: IntegrityLevel) -> bool:
    rank = {
        IntegrityLevel.UNKNOWN: -1,
        IntegrityLevel.LOW: 0,
        IntegrityLevel.MEDIUM: 1,
        IntegrityLevel.HIGH: 2,
        IntegrityLevel.SYSTEM: 3,
    }
    return current is not IntegrityLevel.UNKNOWN and rank[current] >= rank[target]