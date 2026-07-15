import sys

import pytest

from keymouse_studio.infrastructure.input import send_input
from keymouse_studio.infrastructure.input.send_input import SendInputAdapter


@pytest.mark.skipif(sys.platform != "win32", reason="Windows API only")
def test_virtual_key_accepts_character_after_pynput_import() -> None:
    from pynput import keyboard

    assert keyboard is not None
    assert send_input._virtual_key("a") > 0


def test_scan_code_does_not_resolve_virtual_key(monkeypatch: pytest.MonkeyPatch) -> None:
    adapter = SendInputAdapter()
    sent = []

    def fail_virtual_key(key_code: str) -> int:
        raise AssertionError(f"unexpected virtual key lookup: {key_code}")

    monkeypatch.setattr(send_input, "_virtual_key", fail_virtual_key)
    monkeypatch.setattr(adapter, "_send", sent.append)

    adapter._send_key("unsupported", 30, False, False)

    assert len(sent) == 1
    assert sent[0].ki.wVk == 0
    assert sent[0].ki.wScan == 30
    assert sent[0].ki.dwFlags & send_input.KEYEVENTF_SCANCODE