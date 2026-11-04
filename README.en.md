<p align="center">
  <img src="react-vite/public/keyboard-studio-logo.png" alt="KeyMouse Studio" width="128" height="128" />
</p>

<h1 align="center">KeyMouse Studio</h1>

<p align="center">
  Local keyboard & mouse automation for Windows<br />
  Auto-click · Timers · Record & replay · One-key hotkeys, tuned for games
</p>

<p align="center">
  <a href="./README.md">中文</a>
</p>

<p align="center">
  <a href="https://github.com/Geo-ff/keymouse-studio/releases/latest"><img src="https://img.shields.io/github/v/release/Geo-ff/keymouse-studio?display_name=tag&sort=semver&label=release" alt="Release" /></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-0078D4?logo=windows&logoColor=white" alt="Platform" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
  <a href="https://github.com/Geo-ff/keymouse-studio/stargazers"><img src="https://img.shields.io/github/stars/Geo-ff/keymouse-studio?style=flat" alt="Stars" /></a>
  <a href="https://github.com/Geo-ff/keymouse-studio/issues"><img src="https://img.shields.io/github/issues/Geo-ff/keymouse-studio" alt="Issues" /></a>
</p>

## Highlights

- **Record once, replay with one key**: record keyboard and mouse input as a script, give frequent scripts their own hotkey, and press it in any window to run — press again to stop. No need to switch back to the app
- **Works in games**: keys are sent as hardware scan codes and clicks are held for about 30 ms, so most games that read DirectInput / Raw Input see them; first/third-person camera turns can be recorded and replayed
- **Start and stop the clicker anywhere**: set a toggle key for the auto-clicker and press it inside a game to start or stop; works for mouse clicks and key presses
- **Run things on schedule**: after a wait or at a time of day (optionally daily), click, press a key, or run a script
- **Put the mouse back**: end a script with "return to recorded position" and the cursor goes back to where it was before the script started
- **Out of the way, always stoppable**: close the main window to the tray and keep running, watch progress in an always-on-top mini window over the game, and press **F12** to stop everything at any time

## Download & install

1. Open the [latest Release](https://github.com/Geo-ff/keymouse-studio/releases/latest)
2. Download **`KeyMouse-Studio-Setup-*.exe`**
3. Install and launch **KeyMouse Studio**

If GitHub is slow, use the [domestic download mirror (Quark Drive)](./docs/domestic-download.en.md).

**Requirements**: Windows 10 / 11 (x64)

**Notes**:

- The installer includes the runtime you need — **no** separate Python install
- Builds may be **unsigned**; Windows SmartScreen may warn you — choose **More info** → **Run anyway**
- Prefer this repository's GitHub Releases; use the Quark mirror when GitHub is hard to reach
- **Official source**: GitHub user `Geo-ff` / repository `keymouse-studio`

## Quick start

The app's interface is in Chinese; the names in parentheses are the labels you will see.

### Auto-click

1. Open **连点器** (Auto-clicker), choose mouse or keyboard, set the interval and count, then press start (a countdown gives you time to switch to the target window)
2. To toggle it from inside a game: under **设置 → 全局快捷键** (Settings → Global hotkeys) set **连点器开关** (clicker toggle); then press it in any window to start, and again to stop (hotkey starts skip the countdown)

### Record something and repeat it

1. Open **录制** (Recording), start, do the steps once, then stop recording
2. Save it as a script; adjust actions, delays, loops and speed in the script editor
3. In the **脚本** (Scripts) list, set a hotkey in the **快捷键** column; go back to the target window and press it to run, and again to stop

> Tips: for 3D camera turns, switch **鼠标移动录制方式** (mouse movement mode) to **游戏视角（相对移动）** (game camera, relative) before recording. To have the cursor come back when the script ends, add a **回到记录位置** (return to recorded position) action at the end.

### Run on a schedule

Open **定时** (Timed), choose **等待一段时间** (after a wait) or **指定时刻** (at a time, optionally daily), then choose what happens: click, press a key, or run a script.

### Stop at any time

- Press **F12** (configurable) or the emergency-stop button in the toolbar to stop everything and release held keys and buttons where possible
- Under **设置 → 全局快捷键** you can also set **暂停 / 继续** (pause / resume), which works for clicking, timers, recording and playback

## All features

| Feature | What it does |
| --- | --- |
| Auto-clicker | Mouse or keyboard auto-clicking, by count or continuous, at fixed coordinates or the current position; optional toggle hotkey |
| Timed | After a wait or at a set time of day (optionally daily): click, press a key, or run a script |
| Recording | Capture keyboard/mouse input into an editable script; "game camera (relative)" mode records camera turns in 3D games |
| Script editor | Add, edit, drag to reorder, enable/disable actions; key chords, camera moves, "remember / return to mouse position"; undo/redo (Ctrl+Z / Ctrl+Y), copy/paste actions, Ctrl+S to save |
| Playback | Speed, loop count or duration; pause / resume / stop |
| Script manager | Save, duplicate, and delete local scripts; run one from the list and give frequent scripts their own hotkey; import / export .json files to share scripts |
| Global hotkeys | Emergency stop, start/stop recording, start/stop playback, clicker toggle, pause/resume, plus a hotkey per script — all work from any window |
| Safety | Global emergency stop with best-effort release of held keys/buttons; pauses with a warning when the target window runs with higher privileges |
| Tray & mini window | Closing the main window can minimize to the tray and keep running; an always-on-top mini window shows the current task with pause / stop / emergency stop |
| Auto-update | Checks for new versions after launch; the About page always shows what's new in the available version, and the first launch after updating shows what changed |

**Not in the current version**: cloud sync, accounts, online script marketplace, macOS / Linux, image recognition / OCR, and similar.

## Demos

### Showcase

<p align="center">
  <img src="docs/assets/demo-showcase.gif" alt="KeyMouse Studio showcase" width="720" />
</p>

### Real demo

<p align="center">
  <img src="docs/assets/demo-real.gif" alt="KeyMouse Studio real demo" width="720" />
</p>

## Not working in a game?

- **Run as administrator**: many games (or their launchers) run elevated, and Windows blocks input sent from a non-elevated app. The task pauses with a warning; right-click KeyMouse Studio → **Run as administrator** and try again
- **Keys and clicks**: keys are sent as hardware scan codes and mouse clicks are held briefly (about 30 ms), so games that read DirectInput / Raw Input or poll input once per frame can see them. Scripts recorded with older versions do not need to be re-recorded
- **3D camera movement**: first/third-person games turn the camera from relative mouse motion, not cursor positions. Before recording, set **鼠标移动录制方式** (mouse movement mode) on the Recording page to **游戏视角（相对移动）** (game camera, relative), or add a **视角移动** (camera move) action in the script editor with a distance and duration. Recordings store raw mouse motion, so keep the same in-game sensitivity when recording and replaying
- **A hotkey does nothing in one particular game**: a few games block system-wide hotkeys. Switch out of the game and use the buttons instead; the emergency stop (F12 by default) uses a different key listener and usually still works. Please report the game in an Issue
- **Games with anti-cheat**: some games deliberately ignore synthesized input. KeyMouse Studio provides no way around this, and automating such games may break their terms of service

## Auto-update

- Official installers check [GitHub Releases](https://github.com/Geo-ff/keymouse-studio/releases) in the background after startup
- When a new version is found, its release notes pop up once and the **关于** (About) entry in the sidebar shows a red dot; the About page keeps showing the full notes, and you can download and watch progress there
- After the download, restart to install now, or later — the update installs automatically the next time you quit KeyMouse Studio
- The first launch after updating shows once what changed (including any versions you skipped)
- You can also check manually on the About page or via **文件 → 关于与检查更新** (File → About & Check for Updates)

## Important

- The app simulates input **on this machine** — use it only where you are allowed to
- Follow OS, game, site, and software terms, and applicable law; misuse is your responsibility
- Scripts stay **local**; the app does not upload them to a cloud service
- Emergency-stop hotkey is configurable; confirm it works before long runs
- A key bound as a global hotkey is taken over system-wide: pressing it in a game or another program only triggers KeyMouse Studio and no longer types what it used to. Prefer F-keys or Ctrl / Alt combinations
- Script hotkeys and the run buttons in the list run the **saved** script; save editor changes first
- Check imported scripts in the editor before running them: a script can perform any keyboard or mouse action
- If you choose "minimize to tray" when closing the main window, the app keeps running; quit from the tray icon menu, or set the close behaviour to "quit" under Settings → System

## Support the project

This project is free and open source, developed and maintained by an individual in their spare time. If you find it useful, giving it a [Star](https://github.com/Geo-ff/keymouse-studio) is the best way to support the work behind it.

## Community acknowledgment

Thanks to the [LINUX DO](https://linux.do) community for providing a friendly and open space for open-source projects, and to its members for their interest in and support for KeyMouse Studio.

## Feedback

For bugs or suggestions, you can:

- Submit a [GitHub Issue](https://github.com/Geo-ff/keymouse-studio/issues)
- Scan the QR code below with WeChat to join the **KeyMouse Studio Feedback Group**

<p align="center">
  <img src="docs/assets/wechat-feedback-group.png" alt="KeyMouse Studio WeChat feedback group QR code" width="360" />
</p>

> The WeChat group QR code is valid until **November 11, 2026**. If it expires, please ask the maintainer to update it through GitHub Issues.

## For developers

Building, testing, and packaging:

- [Development & build guide](./docs/development.md)
- [Project tracker](./docs/project-tracker.md)
- [Backend design](./docs/backend-design.md)

Stack: Electron · React · TypeScript · Python (FastAPI)

## License

[MIT License](./LICENSE)
