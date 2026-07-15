<p align="center">
  <img src="react-vite/public/keyboard-studio-logo.png" alt="KeyMouse Studio" width="128" height="128" />
</p>

<h1 align="center">KeyMouse Studio</h1>

<p align="center">
  <a href="./README.md">中文</a>
</p>

<p align="center">
  <a href="https://github.com/Geo-ff/keymouse-studio/releases"><img src="https://img.shields.io/github/v/release/Geo-ff/keymouse-studio?display_name=tag&sort=semver&label=release" alt="Release" /></a>
  <a href="https://github.com/Geo-ff/keymouse-studio/actions/workflows/windows-release.yml"><img src="https://img.shields.io/github/actions/workflow/status/Geo-ff/keymouse-studio/windows-release.yml?branch=main&label=Windows%20Release" alt="Windows Release" /></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-0078D4?logo=windows&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/Electron-37-47848F?logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <a href="https://github.com/Geo-ff/keymouse-studio/stargazers"><img src="https://img.shields.io/github/stars/Geo-ff/keymouse-studio?style=flat" alt="Stars" /></a>
  <a href="https://github.com/Geo-ff/keymouse-studio/issues"><img src="https://img.shields.io/github/issues/Geo-ff/keymouse-studio" alt="Issues" /></a>
  <img src="https://img.shields.io/badge/license-not%20declared-lightgrey" alt="License" />
</p>

A local Windows keyboard-and-mouse automation tool for auto-clicking, timed clicks, recording, script editing, and playback.

- Target platform: Windows 10/11 (x64)
- Repository: https://github.com/Geo-ff/keymouse-studio
- Current version: `0.1.0` (source of truth: `desktop-poc/electron/package.json`; release badge appears after the first tag)

## Features

| Module | Description |
| --- | --- |
| Auto-clicker | Left/right/middle button, single/double click, fixed count or continuous, current position or coordinates, countdown and start/pause/resume/stop |
| Timed click | Delayed click, fixed count or loop, countdown and progress |
| Recording | Mouse move/button/wheel and keyboard events, pause/resume/stop, path compression |
| Script editor | Add, edit, delete, duplicate, reorder, bulk ops, enable/disable actions |
| Playback | Speed multiplier, loops, countdown, pause/resume/stop, progress |
| Script management | Versioned JSON, validation, create/save/load/duplicate/delete |
| Safety | Default global emergency stop on `F12`, with best-effort release of tracked keys and buttons |

Out of V1 scope: cloud sync, accounts, online script marketplace, macOS/Linux, image recognition/OCR, conditional expressions and nested loops, bypassing third-party security controls.

## Architecture

```text
Electron 37 desktop shell
  ├─ React + TypeScript + Vite renderer (react-vite/)
  └─ Python 3.12 + FastAPI sidecar (backend/)
       ├─ REST: commands and resources
       └─ WebSocket: state and progress
```

- Development: system Python runs `backend-sidecar.py`
- Production: PyInstaller `keymouse-sidecar.exe` launched from app resources
- Transport: `127.0.0.1` dynamic port + process-scoped session token
- Input: `pynput` for listening, Windows `SendInput` for playback; tests use Fake input by default

## Requirements

| Component | Recommended |
| --- | --- |
| Windows | 10/11 x64 |
| Node.js | 22.x |
| Python | 3.12+ |
| npm | bundled with Node.js |

## Quick start (development)

```powershell
# 1. Frontend deps
cd react-vite
npm ci

# 2. Backend deps
cd ..\backend
python -m pip install -e ".[dev]"

# 3. Electron deps
cd ..\desktop-poc\electron
npm ci
```

### Option A: Vite HMR + Electron

```powershell
# Terminal 1
cd react-vite
npm run dev

# Terminal 2
cd desktop-poc\electron
$env:KEYMOUSE_VITE_URL = "http://127.0.0.1:5173"
npm start
```

### Option B: Production renderer + Electron

```powershell
cd react-vite
npm run build

cd ..\desktop-poc\electron
npm start
```

Optional: set `KEYMOUSE_PYTHON` to choose the Python executable.

## Verification commands

```powershell
# React
cd react-vite
npm run lint
npm run build

# Python
cd ..\backend
python -m ruff check .
python -m mypy
python -m pytest -q

# Electron
cd ..\desktop-poc\electron
npm test
npm run check:main
```

Real input probes are skipped by default; they require explicit confirmation environment variables (see `docs/technical-validation-a.md`).

## Windows installer

```powershell
cd desktop-poc\electron
npm run build:renderer   # or npm run build in react-vite
python -m pip install pyinstaller
npm run build:sidecar
npm run dist:win         # renderer + sidecar + unsigned NSIS
```

Or:

```powershell
npx electron-builder --win nsis --config electron-builder.yml --publish never
```

### Artifacts

| Artifact | Path |
| --- | --- |
| Installer | `desktop-poc/electron/dist/KeyMouse-Studio-Setup-<version>.exe` |
| Update metadata | `desktop-poc/electron/dist/latest.yml` |
| blockmap | `desktop-poc/electron/dist/*.blockmap` |
| Unpacked app | `desktop-poc/electron/dist/win-unpacked/` |
| Sidecar | `.../resources/sidecar/keymouse-sidecar.exe` |
| Renderer | `.../resources/renderer/` |

### Known limitations

- Builds are currently **unsigned**; Windows SmartScreen may block them (“More info” → “Run anyway”).
- Manual acceptance for Chinese install paths, machines without Python, clean install/upgrade/uninstall is tracked in `docs/project-tracker.md`.
- Configure Windows code signing before public distribution.

## Auto-update (GitHub Releases)

- Update feed: public repo `Geo-ff/keymouse-studio`
- No GitHub token is embedded in the client
- Packaged app checks once ~8s after launch; menu **About KeyMouse Studio** → **Check for updates** for manual checks
- Statuses: up to date / update available / download progress / failure / restart now / install later
- Development mode (`npm start`) does not perform production update installs
- Sidecar is stopped before update install

## Release process

Single version source: `version` in `desktop-poc/electron/package.json`.

Tag format: `vX.Y.Z` (must match package.json without the leading `v`).

```powershell
# 1. Bump version and run verification
# 2. Commit and push main
git push origin main

# 3. Tag to trigger GitHub Actions
git tag v0.1.0
git push origin v0.1.0
```

Workflow: `.github/workflows/windows-release.yml`  
Runs frontend checks/build, Python tests, Electron tests, sidecar build, NSIS packaging, and uploads the installer plus `latest.yml` (and related assets) to the GitHub Release.

**Do not** commit certificates, passwords, or tokens. Code signing can use Actions secrets such as `CSC_LINK` / `CSC_KEY_PASSWORD` (see project tracker docs).

## Repository layout

```text
.
├── react-vite/                 # React frontend
├── backend/                    # FastAPI backend (package keymouse_studio)
├── desktop-poc/electron/       # Electron shell, packaging, updates
├── docs/                       # Design and project tracking
│   ├── project-tracker.md
│   ├── backend-design.md
│   └── technical-validation-a.md
└── .github/workflows/          # Windows Release
```

## Security summary

- Sidecar binds only to `127.0.0.1` with a dynamic port and one-time session token
- Electron: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
- Preload exposes a minimal IPC surface; trusted renderer origin is verified
- External links open only the allowlisted official GitHub repository URL
- Scripts are structured JSON and never execute arbitrary code

## Documentation

| Document | Description |
| --- | --- |
| [docs/project-tracker.md](./docs/project-tracker.md) | Scope, task progress, release/build notes |
| [docs/backend-design.md](./docs/backend-design.md) | Backend architecture and API contracts |
| [docs/technical-validation-a.md](./docs/technical-validation-a.md) | Phase A Windows technical validation |

## License

No license file or package-level license declaration is present in this repository yet. Confirm rights and compliance before use, modification, or redistribution.

## Feedback

Issues and suggestions:  
https://github.com/Geo-ff/keymouse-studio/issues