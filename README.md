<p align="center">
  <img src="react-vite/public/keyboard-studio-logo.png" alt="KeyMouse Studio" width="128" height="128" />
</p>

<h1 align="center">KeyMouse Studio</h1>

<p align="center">
  <a href="./README.en.md">English</a>
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
  <img src="https://img.shields.io/badge/license-未声明-lightgrey" alt="License" />
</p>

本地运行的 Windows 键鼠自动化工具：连点、定时点击、键鼠录制、脚本编辑与回放。

- 目标平台：Windows 10/11（x64）
- 仓库：https://github.com/Geo-ff/keymouse-studio
- 当前版本：`0.1.0`（以 `desktop-poc/electron/package.json` 为准；Release 徽章在首次打标签后显示）

## 功能

| 模块 | 说明 |
| --- | --- |
| 连点器 | 左/右/中键，单击/双击，固定次数或持续，当前位置或坐标，倒计时与启停控制 |
| 定时点击 | 延迟后点击，固定次数或循环，倒计时与进度 |
| 键鼠录制 | 鼠标移动/按键/滚轮与键盘事件，暂停/继续/停止，轨迹压缩 |
| 脚本编辑 | 动作新增、编辑、删除、复制、排序、批量操作、启用/禁用 |
| 脚本回放 | 速度倍率、循环、倒计时、暂停/继续/停止与进度 |
| 脚本管理 | 版本化 JSON、校验、创建/保存/加载/复制/删除 |
| 安全控制 | 默认 `F12` 全局急停，并尝试释放已登记的按键与鼠标按钮 |

不在 V1 范围：云同步、账号、在线脚本市场、macOS/Linux、图像识别/OCR、条件表达式与嵌套循环、绕过第三方安全限制。

## 技术架构

```text
Electron 37 桌面外壳
  ├─ React + TypeScript + Vite 渲染进程（react-vite/）
  └─ Python 3.12 + FastAPI sidecar（backend/）
       ├─ REST：命令与资源
       └─ WebSocket：状态与进度
```

- 开发态：系统 Python 启动 `backend-sidecar.py`
- 发布态：PyInstaller 打包的 `keymouse-sidecar.exe`，由 Electron 从安装资源目录拉起
- 通信：仅 `127.0.0.1` 动态端口 + 进程级会话令牌
- 输入：`pynput` 监听，Windows `SendInput` 回放；测试默认 Fake 输入

## 环境要求

| 组件 | 建议版本 |
| --- | --- |
| Windows | 10/11 x64 |
| Node.js | 22.x |
| Python | 3.12+ |
| npm | 随 Node.js |

## 快速开始（开发）

```powershell
# 1. 前端依赖
cd react-vite
npm ci

# 2. 后端依赖
cd ..\backend
python -m pip install -e ".[dev]"

# 3. Electron 依赖
cd ..\desktop-poc\electron
npm ci
```

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

可选：用 `KEYMOUSE_PYTHON` 指定 Python 可执行文件。

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

真实键鼠输入测试默认跳过，需显式确认环境变量后才执行（见 `docs/technical-validation-a.md`）。

## Windows 安装包

```powershell
cd desktop-poc\electron
npm run build:renderer   # 或在 react-vite 中 npm run build
python -m pip install pyinstaller
npm run build:sidecar
npm run dist:win         # 前端 + sidecar + 未签名 NSIS
```

也可：

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

### 已知限制

- 当前为**未签名**测试包，Windows SmartScreen 可能拦截（「更多信息」→「仍要运行」）。
- 中文路径、无 Python 环境、干净机安装/升级/卸载等实机验收项见 `docs/project-tracker.md`。
- 正式对外发布前建议配置 Windows 代码签名证书。

## 自动更新（GitHub Releases）

- 更新源：公开仓库 `Geo-ff/keymouse-studio`
- 客户端**不内置** GitHub Token
- 打包应用启动后约 8 秒静默检查一次；菜单「关于 KeyMouse Studio」→「检查更新」可手动检查
- 支持：已是最新 / 发现新版本 / 下载进度 / 失败提示 / 立即重启安装 / 稍后安装
- 开发模式（`npm start`）不会执行正式更新安装
- 更新安装前会停止后端 sidecar

## 发布流程

版本唯一来源：`desktop-poc/electron/package.json` 的 `version`。

标签格式：`vX.Y.Z`（去掉 `v` 后必须与 package.json 一致）。

```powershell
# 1. 更新版本号并完成验证
# 2. 提交并推送 main
git push origin main

# 3. 打标签触发 GitHub Actions
git tag v0.1.0
git push origin v0.1.0
```

工作流：`.github/workflows/windows-release.yml`  
会运行前端检查与构建、Python 测试、Electron 测试、sidecar 构建、NSIS 打包，并将安装包与 `latest.yml` 等上传到 GitHub Release。

**请勿**把证书、密码或 Token 提交进仓库。代码签名可在 Actions 中配置 `CSC_LINK` / `CSC_KEY_PASSWORD` 等密钥（详见项目跟踪文档）。

## 项目结构

```text
.
├── react-vite/                 # React 前端
├── backend/                    # FastAPI 后端（包名 keymouse_studio）
├── desktop-poc/electron/       # Electron 外壳、打包与更新
├── docs/                       # 设计与项目跟踪
│   ├── project-tracker.md
│   ├── backend-design.md
│   └── technical-validation-a.md
└── .github/workflows/          # Windows Release
```

## 安全边界（摘要）

- sidecar 仅监听 `127.0.0.1`，动态端口 + 一次性会话令牌
- Electron：`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`
- preload 仅暴露最小 IPC；校验受信任渲染来源
- 外链仅允许打开预定义的官方 GitHub 仓库地址
- 脚本为结构化 JSON，不会执行其中的任意代码

## 文档

| 文档 | 说明 |
| --- | --- |
| [docs/project-tracker.md](./docs/project-tracker.md) | 范围、任务进度、发布与构建记录 |
| [docs/backend-design.md](./docs/backend-design.md) | 后端架构与 API 契约 |
| [docs/technical-validation-a.md](./docs/technical-validation-a.md) | 阶段 A Windows 技术验证 |

## 许可证

当前仓库尚未提供 License 文件，也未在包元数据中声明许可证。使用、修改与分发前请自行确认权限与合规要求。

## 贡献与反馈

欢迎通过 GitHub Issues 反馈问题与建议：  
https://github.com/Geo-ff/keymouse-studio/issues