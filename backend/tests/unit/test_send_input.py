import sys

import pytest

from keymouse_studio.infrastructure.input import send_input
from keymouse_studio.infrastructure.input.key_codes import resolve_virtual_key
from keymouse_studio.infrastructure.input.send_input import SendInputAdapter


@pytest.mark.skipif(sys.platform != "win32", reason="Windows API only")
def test_virtual_key_accepts_character_after_pynput_import() -> None:
    from pynput import keyboard

    assert keyboard is not None
    assert resolve_virtual_key("a") > 0


def test_scan_code_does_not_resolve_virtual_key(monkeypatch: pytest.MonkeyPatch) -> None:
    adapter = SendInputAdapter()
    sent = []

    def fail_virtual_key(key_code: str) -> int:
        raise AssertionError(f"unexpected virtual key lookup: {key_code}")

    monkeypatch.setattr(send_input, "resolve_virtual_key", fail_virtual_key)
    monkeypatch.setattr(adapter, "_send", sent.append)

    adapter._send_key("unsupported", 30, False, False)

    assert len(sent) == 1
    assert sent[0].ki.wVk == 0
    assert sent[0].ki.wScan == 30
    assert sent[0].ki.dwFlags & send_input.KEYEVENTF_SCANCODE


def _capture(monkeypatch: pytest.MonkeyPatch, adapter: SendInputAdapter) -> list[send_input.INPUT]:
    sent: list[send_input.INPUT] = []
    monkeypatch.setattr(adapter, "_send", sent.append)
    return sent


def test_virtual_key_is_sent_as_hardware_scan_code(monkeypatch: pytest.MonkeyPatch) -> None:
    adapter = SendInputAdapter()
    sent = _capture(monkeypatch, adapter)
    monkeypatch.setattr(send_input, "resolve_virtual_key", lambda key_code: 0x41)
    monkeypatch.setattr(send_input, "_scan_code_for_virtual_key", lambda vk: (0x1E, False))

    adapter._send_key("a", None, False, False)
    adapter._send_key("a", None, False, True)

    down, up = sent
    assert down.ki.wScan == 0x1E
    assert down.ki.dwFlags & send_input.KEYEVENTF_SCANCODE
    assert not down.ki.dwFlags & send_input.KEYEVENTF_KEYUP
    assert not down.ki.dwFlags & send_input.KEYEVENTF_EXTENDEDKEY
    assert up.ki.wScan == 0x1E
    assert up.ki.dwFlags & send_input.KEYEVENTF_KEYUP


def test_extended_scan_code_from_mapping_sets_extended_flag(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    adapter = SendInputAdapter()
    sent = _capture(monkeypatch, adapter)
    monkeypatch.setattr(send_input, "_scan_code_for_virtual_key", lambda vk: (0x4B, True))

    # Recorded/old scripts may carry extended=False for arrows; the mapping must win.
    adapter._send_key("left", None, False, False)

    assert sent[0].ki.wScan == 0x4B
    assert sent[0].ki.dwFlags & send_input.KEYEVENTF_EXTENDEDKEY


def test_unmapped_virtual_key_falls_back_to_vk_event(monkeypatch: pytest.MonkeyPatch) -> None:
    adapter = SendInputAdapter()
    sent = _capture(monkeypatch, adapter)
    monkeypatch.setattr(send_input, "resolve_virtual_key", lambda key_code: 0xB3)
    monkeypatch.setattr(send_input, "_scan_code_for_virtual_key", lambda vk: (0, False))

    adapter._send_key("vk_179", None, False, False)

    assert sent[0].ki.wVk == 0xB3
    assert sent[0].ki.wScan == 0
    assert not sent[0].ki.dwFlags & send_input.KEYEVENTF_SCANCODE


def test_prefixed_scan_code_is_split_into_extended_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    adapter = SendInputAdapter()
    sent = _capture(monkeypatch, adapter)

    adapter._send_key("left", 0xE04B, False, False)

    assert sent[0].ki.wScan == 0x4B
    assert sent[0].ki.dwFlags & send_input.KEYEVENTF_SCANCODE
    assert sent[0].ki.dwFlags & send_input.KEYEVENTF_EXTENDEDKEY


@pytest.mark.parametrize(
    ("virtual_key", "mapped", "expected"),
    [
        (0x41, 0x001E, (0x1E, False)),  # A
        (0x25, 0xE04B, (0x4B, True)),  # LEFT reported with E0 prefix
        (0x25, 0x004B, (0x4B, True)),  # LEFT without prefix must still be extended
        (0xA5, 0xE038, (0x38, True)),  # RIGHT ALT
        (0x13, 0xE11D, (0, False)),  # PAUSE (E1 sequence) falls back to VK
        (0xFF, 0x0000, (0, False)),  # no scan code
    ],
)
def test_split_mapped_scan_code(virtual_key: int, mapped: int, expected: tuple[int, bool]) -> None:
    assert send_input._split_mapped_scan_code(virtual_key, mapped) == expected
