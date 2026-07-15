from __future__ import annotations

import json
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
exe = ROOT / "resources" / "sidecar" / "keymouse-sidecar.exe"
p = subprocess.Popen(
    [str(exe)],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    stdin=subprocess.PIPE,
    text=True,
)
try:
    assert p.stdout is not None and p.stdin is not None
    line = p.stdout.readline()
    print("HANDSHAKE:", line.strip())
    data = json.loads(line)
    assert data.get("host", "127.0.0.1") == "127.0.0.1"
    assert isinstance(data["port"], int) and data["port"] > 0
    assert len(data["token"]) >= 32
    req = urllib.request.Request(
        f"http://127.0.0.1:{data['port']}/api/v1/health",
        headers={"Authorization": f"Bearer {data['token']}"},
    )
    with urllib.request.urlopen(req, timeout=5) as response:
        body = response.read()
        print("HEALTH:", response.status, body[:200])
    p.stdin.write("shutdown\n")
    p.stdin.flush()
    code = p.wait(timeout=8)
    print("EXIT:", code)
except Exception as error:
    print("ERR:", error)
    p.kill()
    if p.stderr is not None:
        print("STDERR:", p.stderr.read()[:2000])
    raise SystemExit(1)