"""Key-code normalization and validation shared by schema and SendInput."""

from __future__ import annotations

import sys

MODIFIER_KEYS = frozenset(
    {
        "alt",
        "alt_l",
        "alt_r",
        "ctrl",
        "ctrl_l",
        "ctrl_r",
        "shift",
        "shift_l",
        "shift_r",
        "win",
        "win_l",
        "win_r",
        "cmd",
        "cmd_l",
        "cmd_r",
        "meta",
    }
)

# Canonical modifier used for hotkey chord comparison.
MODIFIER_CANONICAL = {
    "alt": "alt",
    "alt_l": "alt",
    "alt_r": "alt",
    "ctrl": "ctrl",
    "ctrl_l": "ctrl",
    "ctrl_r": "ctrl",
    "shift": "shift",
    "shift_l": "shift",
    "shift_r": "shift",
    "win": "win",
    "win_l": "win",
    "win_r": "win",
    "cmd": "win",
    "cmd_l": "win",
    "cmd_r": "win",
    "meta": "win",
}

NAMED_VIRTUAL_KEYS: dict[str, int] = {
    "alt": 0x12,
    "alt_l": 0xA4,
    "alt_r": 0xA5,
    "backspace": 0x08,
    "caps_lock": 0x14,
    "ctrl": 0x11,
    "ctrl_l": 0xA2,
    "ctrl_r": 0xA3,
    "delete": 0x2E,
    "down": 0x28,
    "end": 0x23,
    "enter": 0x0D,
    "esc": 0x1B,
    "home": 0x24,
    "insert": 0x2D,
    "left": 0x25,
    "page_down": 0x22,
    "page_up": 0x21,
    "right": 0x27,
    "shift": 0x10,
    "shift_l": 0xA0,
    "shift_r": 0xA1,
    "space": 0x20,
    "tab": 0x09,
    "up": 0x26,
    "win": 0x5B,
    "win_l": 0x5B,
    "win_r": 0x5C,
    "cmd": 0x5B,
    "cmd_l": 0x5B,
    "cmd_r": 0x5C,
    "meta": 0x5B,
}
NAMED_VIRTUAL_KEYS.update({f"f{number}": 0x6F + number for number in range(1, 25)})

EXTENDED_KEY_CODES = frozenset(
    {
        "alt_r",
        "ctrl_r",
        "delete",
        "down",
        "end",
        "home",
        "insert",
        "left",
        "page_down",
        "page_up",
        "right",
        "up",
        "win",
        "win_l",
        "win_r",
        "cmd",
        "cmd_l",
        "cmd_r",
        "meta",
    }
)

_KEY_ALIASES = {
    "escape": "esc",
    "return": "enter",
    "spacebar": "space",
    "arrowup": "up",
    "arrowdown": "down",
    "arrowleft": "left",
    "arrowright": "right",
    "pageup": "page_up",
    "pagedown": "page_down",
    "control": "ctrl",
    " ": "space",
}


def normalize_key_code(key_code: str) -> str:
    raw = key_code.strip().lower().replace("-", "_")
    compact = raw.replace("_", "")
    if raw in _KEY_ALIASES:
        return _KEY_ALIASES[raw]
    if compact in _KEY_ALIASES:
        return _KEY_ALIASES[compact]
    if raw in NAMED_VIRTUAL_KEYS or raw in MODIFIER_KEYS:
        return raw
    if raw.startswith("vk_"):
        return raw
    if len(key_code.strip()) == 1:
        return key_code.strip().lower()
    return raw


def is_modifier_key(key_code: str) -> bool:
    return normalize_key_code(key_code) in MODIFIER_KEYS


def is_extended_key(key_code: str, extended: bool | None = None) -> bool:
    if extended is not None:
        return extended
    return normalize_key_code(key_code) in EXTENDED_KEY_CODES


def resolve_virtual_key(key_code: str) -> int:
    normalized = normalize_key_code(key_code)
    if normalized in NAMED_VIRTUAL_KEYS:
        return NAMED_VIRTUAL_KEYS[normalized]
    if normalized.startswith("vk_"):
        return int(normalized[3:])
    if len(key_code) == 1 or len(normalized) == 1:
        char = key_code if len(key_code) == 1 else normalized
        if sys.platform == "win32":
            import ctypes

            result = int(ctypes.windll.user32.VkKeyScanW(char))
            if result != -1:
                return result & 0xFF
        if char.isalnum():
            return ord(char.upper())
    raise ValueError(f"Unsupported key code: {key_code}")


def validate_key_code(key_code: str, scan_code: int | None = None) -> str:
    if not key_code or not key_code.strip():
        raise ValueError("keyCode is required")
    if len(key_code) > 64:
        raise ValueError("keyCode is too long")
    normalized = normalize_key_code(key_code)
    if scan_code is not None:
        if scan_code < 0:
            raise ValueError("scanCode must be non-negative")
        return normalized
    if normalized in NAMED_VIRTUAL_KEYS or normalized in MODIFIER_KEYS:
        return normalized
    if normalized.startswith("vk_"):
        try:
            int(normalized[3:])
        except ValueError as exc:
            raise ValueError(f"Unsupported key code: {key_code}") from exc
        return normalized
    if len(normalized) == 1 and normalized.isprintable():
        return normalized
    raise ValueError(f"Unsupported key code: {key_code}")


def keys_to_hotkey_chord(key_codes: list[str]) -> str:
    """Build a hotkey-compatible chord (ctrl+alt+shift+win + primary)."""
    modifiers: set[str] = set()
    primaries: list[str] = []
    for code in key_codes:
        normalized = normalize_key_code(code)
        if normalized in MODIFIER_CANONICAL:
            modifiers.add(MODIFIER_CANONICAL[normalized])
        else:
            primaries.append(normalized)
    order = ("ctrl", "alt", "shift", "win")
    parts = [m for m in order if m in modifiers]
    if len(primaries) != 1:
        return "+".join([*parts, *primaries])
    return "+".join([*parts, primaries[0]])