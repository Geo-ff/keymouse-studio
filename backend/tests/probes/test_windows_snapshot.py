from __future__ import annotations

import sys

import pytest

from probes.windows.system_probe import snapshot

pytestmark = pytest.mark.windows_probe


@pytest.mark.skipif(sys.platform != "win32", reason="Windows only")
def test_read_only_system_snapshot() -> None:
    result = snapshot()
    assert result.dpi_awareness_enabled
    assert result.displays
    assert result.bounds.width > 1
    assert result.bounds.height > 1
    assert result.process_integrity.value != "unknown"