# KeyMouse Studio — 开发与构建说明

面向贡献者与维护者。最终用户请先阅读根目录 [README.md](../README.md)。

## 架构概览

```text
Electron 桌面外壳
  ├─ React + TypeScript + Vite 渲染进程（react-vite/）
  └─ Python 3.12 + FastAPI sidecar（backend/）
       ├─ REST：命令与资源
       └─ WebSocket：状态与进度
```

- 开发态：系统 Python 启动 `desktop-poc/electron/backend-sidecar.py`
- 发布态：PyInstaller 打包的 `keymouse-sidecar.exe`，由 Electron 从安装资源目录拉起
- 通信：仅 `127.0.0.1` 动态端口 + 进程级会话令牌
- 输入：`pynput` 监听，Windows `SendInput` 回放；测试默认 Fake 输入

### 安全边界（摘要）

- sidecar 仅监听 `127.0.0.1`
- Electron：`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`
- preload 仅暴露最小 IPC；校验受信任渲染来源
- 外链仅允许打开预定义的官方 GitHub 仓库地址
- 脚本为结构化 JSON，不会执行其中的任意代码

## 环境要求

| 组件 | 建议版本 |
| --- | --- |
| Windows | 10/11 x64 |
| Node.js | 22.x |
| Python | 3.12+ |
| npm | 随 Node.js |

## 安装依赖

```powershell
# 前端
cd react-vite
npm ci

# 后端
cd ..\backend
python -m pip install -e ".[dev]"

# Electron
cd ..\desktop-poc\electron
npm ci
```

## 开发运行

### 方式 A：Vite 热更新 + Electron

```powershell
# 终端 1
cd react-vite
npm run dev

# 终端 2
cd desktop-poc\electron
$env:KEYMOUSE_VITE_URL = "http://127.0.0.1:5173"
npm start
```

### 方式 B：生产前端资源 + Electron

```powershell
cd react-vite
npm run build

cd ..\desktop-poc\electron
npm start
```

可选：用环境变量 `KEYMOUSE_PYTHON` 指定 Python 可执行文件。

## 验证命令

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

真实键鼠输入测试默认跳过，需显式确认环境变量后才执行（见 [technical-validation-a.md](./technical-validation-a.md)）。

## Windows 安装包

```powershell
cd desktop-poc\electron
npm run build:renderer
python -m pip install pyinstaller
npm run build:sidecar
npm run dist:win
```

或：

```powershell
npx electron-builder --win nsis --config electron-builder.yml --publish never
```

### 产物位置

| 产物 | 路径 |
| --- | --- |
| 安装包 | `desktop-poc/electron/dist/KeyMouse-Studio-Setup-<version>.exe` |
| 更新元数据 | `desktop-poc/electron/dist/latest.yml` |
| blockmap | `desktop-poc/electron/dist/*.blockmap` |
| 解包目录 | `desktop-poc/electron/dist/win-unpacked/` |
| Sidecar | `.../resources/sidecar/keymouse-sidecar.exe` |
| 前端资源 | `.../resources/renderer/` |

未签名包会触发 SmartScreen。正式对外发布前建议配置 Windows 代码签名（见 [project-tracker.md](./project-tracker.md)）。

## 自动更新（实现说明）

- 提供方：`electron-updater` + 公开仓库 GitHub Releases（`Geo-ff/keymouse-studio`）
- 客户端不内置 GitHub Token
- 打包应用启动后静默检查；菜单/关于中可手动检查
- 开发模式（`!app.isPackaged`）不执行正式更新安装
- 更新安装前会停止后端 sidecar

## 发布流程

版本唯一来源：`desktop-poc/electron/package.json` 的 `version`。

标签格式：`vX.Y.Z`（去掉 `v` 后必须与 package.json 一致）。

```powershell
# 1. 更新版本号并完成验证
# 2. 提交并推送 main
git push origin main

# 3. 打标签触发 GitHub Actions
git tag v0.1.2
git push origin v0.1.2
```

工作流：`.github/workflows/windows-release.yml`  
会运行前端检查与构建、Python 测试、Electron 测试、sidecar 构建、NSIS 打包，并将安装包与 `latest.yml` 等上传到 GitHub Release。

**请勿**把证书、密码或 Token 提交进仓库。代码签名可在 Actions 中配置 `CSC_LINK` / `CSC_KEY_PASSWORD` 等密钥。

## 项目结构

```text
.
├── react-vite/                 # React 前端
├── backend/                    # FastAPI 后端（包名 keymouse_studio）
├── desktop-poc/electron/       # Electron 外壳、打包与更新
├── docs/                       # 设计与项目跟踪
└── .github/workflows/          # Windows Release
```

## 相关文档

| 文档 | 说明 |
| --- | --- |
| [project-tracker.md](./project-tracker.md) | 范围、任务进度、发布记录 |
| [backend-design.md](./backend-design.md) | 后端架构与 API 契约 |
| [technical-validation-a.md](./technical-validation-a.md) | 阶段 A Windows 技术验证 |