"""Build Windows sidecar executable with PyInstaller."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
BACKEND_SRC = REPO / "backend" / "src"
ENTRY = ROOT / "backend-sidecar.py"
OUT_DIR = ROOT / "resources" / "sidecar"
WORK_DIR = ROOT / "build" / "sidecar-work"
SPEC_DIR = ROOT / "build" / "sidecar-spec"
DIST_DIR = ROOT / "build" / "sidecar-dist"

EXCLUDES = [
    "IPython",
    "matplotlib",
    "numpy",
    "pandas",
    "scipy",
    "PIL",
    "tkinter",
    "sphinx",
    "docutils",
    "jedi",
    "parso",
    "black",
    "yapf",
    "nbformat",
    "notebook",
    "jupyter",
    "torch",
    "tensorflow",
    "cv2",
    "sklearn",
    "pytest",
    "mypy",
    "ruff",
]


def main() -> int:
    if not ENTRY.is_file():
        print(f"missing entry: {ENTRY}", file=sys.stderr)
        return 1
    if not BACKEND_SRC.is_dir():
        print(f"missing backend src: {BACKEND_SRC}", file=sys.stderr)
        return 1

    for path in (WORK_DIR, SPEC_DIR, DIST_DIR):
        if path.exists():
            shutil.rmtree(path)
        path.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--console",
        "--name",
        "keymouse-sidecar",
        "--paths",
        str(BACKEND_SRC),
        "--distpath",
        str(DIST_DIR),
        "--workpath",
        str(WORK_DIR),
        "--specpath",
        str(SPEC_DIR),
        "--hidden-import",
        "uvicorn.logging",
        "--hidden-import",
        "uvicorn.loops",
        "--hidden-import",
        "uvicorn.loops.auto",
        "--hidden-import",
        "uvicorn.protocols",
        "--hidden-import",
        "uvicorn.protocols.http",
        "--hidden-import",
        "uvicorn.protocols.http.auto",
        "--hidden-import",
        "uvicorn.protocols.websockets",
        "--hidden-import",
        "uvicorn.protocols.websockets.auto",
        "--hidden-import",
        "uvicorn.lifespan",
        "--hidden-import",
        "uvicorn.lifespan.on",
        "--hidden-import",
        "keymouse_studio",
        "--collect-submodules",
        "keymouse_studio",
        "--collect-submodules",
        "pynput",
    ]
    for name in EXCLUDES:
        cmd.extend(["--exclude-module", name])
    cmd.append(str(ENTRY))

    print("Running:", " ".join(cmd), flush=True)
    subprocess.check_call(cmd, cwd=str(ROOT))

    built = DIST_DIR / "keymouse-sidecar.exe"
    if not built.is_file():
        built = DIST_DIR / "keymouse-sidecar"
    if not built.is_file():
        print("PyInstaller did not produce sidecar binary", file=sys.stderr)
        return 1

    target = OUT_DIR / built.name
    shutil.copy2(built, target)
    print(f"Sidecar written to {target} ({target.stat().st_size} bytes)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
