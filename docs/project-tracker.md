# KeyMouse Studio V1 项目跟踪

> 状态：V1 开发基线
> 更新日期：2026-07-16
> 目标平台：Windows 10/11
> 当前阶段：阶段 D 集成与发布接近完成（干净环境安装/卸载与正式 Release 更新链路已人工验收；代码签名与发布矩阵复验仍待处理）
> GitHub 仓库：`https://github.com/Geo-ff/keymouse-studio`（已公开）
> 后端设计：`docs/backend-design.md`
> 技术验证：`docs/technical-validation-a.md`

## 1. 项目定位

开发一个本地运行的 Windows 键鼠自动化工具，提供鼠标连点、定时点击、键鼠录制、动作编辑和脚本回放能力。

核心目标：

- 普通用户无需编程即可创建自动化脚本。
- 用户可以录制动作，也可以手动编排动作。
- 执行过程可暂停、继续和紧急停止。
- 脚本可保存、加载、复制和复用。
- 默认本地运行，不依赖云服务。

## 2. V1 范围

### 2.1 连点器

- 支持鼠标左键、右键和中键。
- 支持单击和双击。
- 点击间隔支持小时、分钟、秒和毫秒。
- 支持固定次数和持续执行。
- 支持当前鼠标位置和指定屏幕坐标。
- 支持启动、暂停、继续和停止。

### 2.2 定时点击

- 等待指定时长后执行点击。
- 支持固定次数和循环执行。
- 支持倒计时显示。
- 支持记录目标坐标。

### 2.3 键鼠录制

- 录制鼠标移动、按下、释放和滚轮动作。
- 录制键盘按下和释放动作。
- 保存动作发生时间和相邻动作间隔。
- 支持暂停、继续和停止录制。
- 显示录制时长和动作数量。

### 2.4 脚本编辑

- 以动作列表或时间线展示脚本。
- 支持新增、编辑、删除、复制动作。
- 支持启用或禁用单个动作。
- 支持动作排序和批量删除。
- 支持手动插入等待、鼠标动作和键盘动作。

### 2.5 脚本回放

- 支持固定次数和循环执行。
- 支持速度倍率。
- 支持启动、暂停、继续和停止。
- 显示当前动作、执行次数和整体进度。
- 运行前支持倒计时。

### 2.6 脚本管理

- 新建、打开、保存和另存为。
- 保存脚本名称、说明、动作列表和版本号。
- 显示最近使用脚本。
- 对脚本数据执行格式校验。

### 2.7 安全机制

- 默认使用 `F12` 作为全局急停热键。
- 执行状态必须在界面中明显显示。
- 急停后立即释放当前按下的鼠标按键和键盘按键。
- 屏幕分辨率或缩放发生变化时给出坐标风险提示。
- 不提供绕过权限、验证码、风控或网站限制的功能。

## 3. V1 非目标

- 云同步和账号系统。
- 在线脚本市场。
- 跨设备同步。
- macOS 和 Linux 支持。
- 图像识别、OCR 和目标追踪。
- 条件判断、循环嵌套和变量表达式。
- 绕过第三方软件安全限制。

## 4. 推荐技术方案

V1 采用以下结构，详细后端基线见 `docs/backend-design.md`：

- 桌面外壳：Electron 37，承载 React/Vite 渲染进程并管理独立 Python/FastAPI sidecar。
- 前端：React + TypeScript，当前原型位于 `react-vite/`。
- 本地应用服务：FastAPI 异步路由，REST 处理命令与资源，WebSocket 推送实时状态。
- 本地输入引擎：Python，负责监听、执行、计时和全局急停。
- 输入监听：先验证 `pynput` 的稳定性。
- 输入回放：优先验证 Windows `SendInput`，避免仅依赖高层模拟接口。
- 数据格式：版本化 JSON，初始 `schemaVersion` 为 `1`。
- 前后端通信：使用异步 typed service interface，支持严格互斥的 `mock` 和 `real` 模式；Real 连接失败不得静默回退 Mock。
- 服务安全：仅监听 `127.0.0.1`，REST 和 WebSocket 均校验桌面外壳生成的一次性会话令牌。

阶段 A 技术路径已通过并冻结 Electron 桌面方案。100%、125%、150% DPI 和管理员目标窗口的完整发布矩阵保留到 B2/B3 正式适配器完成后复验。

## 5. 模块边界

### 5.1 输入监听器

负责采集原始键盘和鼠标事件，不负责持久化和界面状态。

### 5.2 录制器

负责将原始事件转换为标准动作，计算时间间隔，并对高频鼠标移动事件进行合理压缩。

### 5.3 执行引擎

负责按脚本顺序执行动作，维护运行、暂停、停止和急停状态。

### 5.4 脚本仓储

负责脚本创建、校验、保存、加载和格式迁移。

### 5.5 应用服务接口

向前端暴露录制、回放、脚本管理、实时状态和配置能力。前端不得直接调用底层键鼠库。

### 5.6 React 前端

负责配置、状态展示、脚本编辑和操作反馈，不承担真实键鼠执行逻辑。

## 6. 执行状态机

统一状态建议如下：

- `idle`：空闲。
- `countdown`：运行前倒计时。
- `recording`：正在录制。
- `running`：正在回放或连点。
- `paused`：已暂停。
- `stopping`：正在安全停止并释放按键。
- `error`：发生错误。

任何状态下触发急停，都必须进入安全停止流程并最终回到 `idle`。

## 7. 脚本格式草案

脚本至少包含：

- `schemaVersion`：格式版本。
- `id`：脚本唯一标识。
- `name`：脚本名称。
- `description`：说明。
- `createdAt`、`updatedAt`：时间信息。
- `settings`：默认速度、循环次数和运行前倒计时。
- `actions`：动作列表。

每个动作至少包含：

- `id`：动作唯一标识。
- `type`：动作类型。
- `enabled`：是否启用。
- `delayBeforeMs`：执行前等待时间。
- `payload`：动作参数。

首批动作类型：

- `mouse_move`
- `mouse_button_down`
- `mouse_button_up`
- `mouse_click`
- `mouse_wheel`
- `key_down`
- `key_up`
- `wait`

## 8. 开发任务

### 阶段 A：需求与技术验证

- [x] 完成定时点击命令行原型。
- [x] 明确 V1 核心功能范围。
- [x] 输出前端设计提示词。
- [x] 验证 `pynput` 全局键鼠监听。
- [x] 验证 Windows `SendInput` 键鼠回放。
- [x] 验证 `F12` 全局急停。
- [x] 验证暂停后恢复的时间语义。
- [x] 验证 Windows DPI 缩放与多显示器坐标。
- [x] 验证普通权限与管理员权限窗口之间的输入限制。
- [x] 冻结桌面技术方案。

### 阶段 B：后端核心与脚本格式

#### B0：工程骨架

- [x] 编写后端技术设计与开发基线文档。
- [x] 创建 `backend/` Python 包与 FastAPI 应用工厂。
- [x] 实现配置、会话令牌鉴权和统一错误处理。
- [x] 实现 `/health`、`/capabilities`、`/state` 和 `/events` 骨架。
- [x] 配置 pytest、`httpx.AsyncClient`、静态检查和类型检查。

#### B1：领域契约

- [x] 定义版本化脚本与动作 Pydantic Schema。
- [x] 实现脚本校验、错误信息和版本迁移框架。
- [x] 实现统一执行状态机和 `operationId`。
- [x] 实现带递增 `sequence` 的事件信封。
- [x] 实现 JSON 脚本仓储和原子保存。
- [x] 编写状态机、Schema、仓储和 API 契约测试。

#### B2：计时、连点与定时点击

- [x] 实现基于单调时钟的计时、暂停和取消机制。
- [x] 实现 Windows `SendInput` 适配器和 Fake 测试适配器。
- [x] 将当前定时点击原型迁移到执行引擎。
- [x] 实现连点器与定时点击配置模型。
- [x] 实现启动、暂停、继续、停止和急停。
- [x] 实现运行状态与进度事件输出。
- [x] 覆盖固定次数、无限循环和边界参数测试。

#### B3：键鼠录制与回放

- [x] 实现原始事件监听。
- [x] 实现动作标准化。
- [x] 实现鼠标移动事件压缩。
- [x] 实现键盘组合键录制。
- [x] 实现脚本回放和进度事件。
- [x] 实现安全释放按键逻辑。
- [x] 覆盖暂停、急停和异常恢复测试。

### 阶段 C：React 前端与契约迁移

- [x] 创建 React + TypeScript 前端原型。
- [x] 实现控制台、连点器、定时点击、录制、脚本和设置页面原型。
- [x] 实现脚本编辑器原型。
- [x] 实现 Mock 服务和 typed service interface 原型。
- [x] 按 `docs/backend-design.md` 迁移 Script、Action 和状态类型。
- [x] 将 service 方法迁移为统一异步接口。
- [x] 实现 `RealAutomationService` 和 WebSocket 状态订阅。
- [x] 实现严格互斥且真实生效的 mock/real 模式切换。
- [x] 接入结构化错误、能力检测和全局热键状态。
- [x] 完成浅色和深色主题原型。
- [x] 检查 1280×720、1440×900 和 1920×1080 原型布局。

### 阶段 D：集成与发布

- [x] 联调前端与 FastAPI 本地输入引擎。
- [x] 完成桌面外壳对子进程、动态端口和会话令牌的管理。
- [x] 添加异常日志和可读错误提示。
- [x] 完成端到端核心流程测试（Fake 输入；见 `backend/tests/integration/test_phase_d_loop.py`）。

#### D1：产品命名与应用元数据

- [x] 将误用的 `KeyBoard Studio`、`Keyboard Studio` 统一更正为 `KeyMouse Studio`。
- [x] 核对并统一窗口标题、系统菜单、关于信息、安装包名称、可执行文件名称、应用图标、通知来源、版本资源和用户可见文案中的产品名称。
- [x] 保留内部 Python 包名 `keymouse_studio`，除非发布验证表明必须迁移，避免无收益地扩大改动范围。
- [x] 将 Electron 应用版本作为唯一版本来源，并在“关于 KeyMouse Studio”中展示当前版本（`app.getVersion()`）。

#### D2：Windows 打包与安装验证

- [x] 使用 `electron-builder` 和 NSIS 生成 Windows 安装包（本地已生成未签名测试包）。
- [x] 将 Python/FastAPI 后端打包为 Windows sidecar 可执行文件，并由 Electron 在发布态管理生命周期。
- [x] 配置安装包产品名称、发布者、版本、图标、安装路径和卸载信息。
- [x] 验证中文路径、无 Python 环境、普通用户权限和干净 Windows 10/11 环境下的安装、启动、升级与卸载（2026-07-16 人工验收完成）。
- [ ] 正式发布前配置 Windows 代码签名；未签名包会触发 SmartScreen 警告（见下文已知限制）。

#### D3：GitHub 仓库与 Release 更新

- [x] 将 `https://github.com/Geo-ff/keymouse-studio` 配置为应用的固定官方仓库入口，仅通过系统浏览器打开该白名单地址。
- [x] 将顶部“帮助”菜单改为“关于 KeyMouse Studio”，集中提供关于信息、当前版本、GitHub 仓库和“检查更新”入口。
- [x] 使用 `electron-updater` 对接 GitHub Releases，支持启动后静默检查和用户手动检查更新（开发模式禁用正式安装）。
- [x] 展示“已是最新版本、发现新版本、下载进度、下载失败、下载完成”等状态；下载完成后允许“立即重启安装”或“稍后安装”。
- [x] 使用 GitHub Actions 构建 Windows 安装包，并在 Release 中发布安装程序、`latest.yml`、校验文件和发布说明（工作流已添加；需推送 `vX.Y.Z` 标签触发）。
- [x] 客户端不内置 GitHub Token；公开仓库后由客户端直连 GitHub Releases。
- [x] 验证版本比较、重复检查、网络失败、下载中断、安装失败和更新后版本显示（2026-07-16 基于真实 GitHub Release 与实机安装验收完成）。
- [x] 编写发布说明、构建命令、更新机制与风险提示（见本节“发布与构建记录”）。

### 发布与构建记录（2026-07-15；验收状态更新于 2026-07-16）

**版本规则**

- 唯一发布版本：`desktop-poc/electron/package.json` 的 `version`。
- Git 标签：`vX.Y.Z`（与 package.json 一致，例如 `v0.1.0`）。
- `latest.yml` 与安装包文件名由 electron-builder 根据该版本生成。

**本地构建命令**（在仓库根目录）

```powershell
# 前端
cd react-vite; npm ci; npm run lint; npm run build

# 后端测试
cd ..\backend; python -m pip install -e ".[dev]"; python -m pytest -q

# Electron / sidecar / 安装包
cd ..\desktop-poc\electron
npm ci
npm test
npm run check:main
python -m pip install pyinstaller
npm run build:sidecar
# 或：npm run dist:win   （含前端构建 + sidecar + NSIS）
npx electron-builder --win nsis --config electron-builder.yml --publish never
```

**产物位置**

| 产物 | 路径 |
|---|---|
| NSIS 安装包 | `desktop-poc/electron/dist/KeyMouse-Studio-Setup-0.1.0.exe` |
| 更新元数据 | `desktop-poc/electron/dist/latest.yml` |
| blockmap | `desktop-poc/electron/dist/KeyMouse-Studio-Setup-0.1.0.exe.blockmap` |
| 解包目录 | `desktop-poc/electron/dist/win-unpacked/` |
| 主程序 | `dist/win-unpacked/KeyMouse Studio.exe` |
| Sidecar | `dist/win-unpacked/resources/sidecar/keymouse-sidecar.exe` |
| 前端资源 | `dist/win-unpacked/resources/renderer/` |

**更新机制**

- 提供方：`electron-updater` + GitHub Releases（`Geo-ff/keymouse-studio`）。
- 启动后约 8 秒静默检查一次；菜单「检查更新」可手动触发。
- 开发态（`!app.isPackaged`）只提示“开发模式不可更新”，不下载/不安装。
- 更新安装前 `before-quit` 会停止 sidecar。
- 客户端无 GitHub Token。

**CI**

- 工作流：`.github/workflows/windows-release.yml`
- 触发：推送标签 `v*.*.*`
- 步骤：Node/Python 依赖 → 前端 lint/build → pytest → Electron 测试 → sidecar → electron-builder → 上传 Release 资产

**首次发布步骤（人工）**

1. 将 `desktop-poc/electron/package.json` 版本改为目标版本（如 `0.1.0`）。
2. 运行上述验证命令，确认全部通过。
3. 提交代码并推送到 `main`（不要自动打标签）。
4. 创建并推送标签：`git tag v0.1.0` → `git push origin v0.1.0`。
5. 等待 GitHub Actions 生成 Release 与安装包。
6. 在干净 Windows 上安装、启动、检查关于菜单版本、检查更新、卸载。

**人工验收记录（2026-07-16）**

- 干净环境安装：已在无系统 Python、普通用户权限、含中文路径的 Windows 10/11 环境下完成安装、启动、升级与卸载验收。
- 正式 Release 更新：已基于公开 GitHub Releases 完成版本比较、重复检查、网络失败/下载中断相关场景，以及更新后关于页版本显示验收。

**已知限制（仍待处理）**

- 未签名安装包会触发 Windows SmartScreen；正式对外发布前配置代码签名（`CSC_LINK` / `CSC_KEY_PASSWORD`，工作流中已预留注释位置，勿提交证书）。
- 发布矩阵复验（DPI 缩放、多显示器坐标、管理员目标窗口、F12 延迟、sidecar 异常回收等）见 `docs/technical-validation-a.md` §5，仍建议在正式对外前按清单手工复验。
- sidecar 使用 PyInstaller onefile，冷启动握手超时放宽至 15s。

## 9. V1 验收标准

- 用户能够在图形界面完成连点器配置并执行。
- 用户能够录制一段包含鼠标与键盘动作的脚本。
- 用户能够编辑、保存、重新打开并回放脚本。
- 暂停后不会丢失动作或产生明显时间漂移。
- `F12` 能在运行和录制过程中触发急停。
- 急停后不存在残留按键或鼠标按下状态。
- 非法脚本不会进入执行流程，并能显示具体错误。
- 前端 `lint`、TypeScript 类型检查和生产构建通过。
- 核心 Python 测试通过。
- 目标分辨率下无控件重叠和文本溢出。

## 10. 风险与待确认项

- [已确定] 产品展示名称统一为 `KeyMouse Studio`；`KeyBoard Studio` 和 `Keyboard Studio` 均为误用名称。
- [已确定] 官方仓库为 `https://github.com/Geo-ff/keymouse-studio`（已公开）。
- [已确定] Windows 安装包采用 Electron + `electron-builder` + NSIS，自动更新采用 `electron-updater` + GitHub Releases。
- [已确定] 客户端不内置 GitHub Token；公开仓库使用客户端直连 Releases。
- [风险] 未签名安装包触发 SmartScreen；需后续接入 Windows 代码签名证书。
- [已完成] 干净环境安装/卸载、中文路径、无 Python 环境、真实 Release 升级链路（2026-07-16 人工验收）。
- [待人工] 发布矩阵复验：DPI 缩放命中、多显示器布局变化提示、管理员目标窗口警告、F12 延迟、sidecar 异常回收（见 `docs/technical-validation-a.md` §5）。
- [已确定] V1 桌面外壳使用 Electron 37；选择理由和验证证据见 `docs/technical-validation-a.md`。
- [已确定] V1 使用桌面外壳启动 FastAPI 子进程；REST 处理命令与资源，WebSocket 推送状态。
- [已确定] 后端仅监听 `127.0.0.1`，使用进程级一次性会话令牌鉴权。
- [已确定] V1 过滤 Win、Alt+Tab、Ctrl+Alt+Del 等系统保留组合键；`F12` 仅作为全局急停，不写入录制动作。
- [已确定] 多显示器使用 Windows 虚拟桌面物理像素坐标，并保存显示器布局摘要。
- [已确定] 鼠标移动先按可配置最小时间间隔采样，再使用 Ramer-Douglas-Peucker 算法按可配置像素误差压缩并保留端点。
- [TBD] V1 是否需要脚本导入导出确认弹窗及来源标识。

## 11. QoderWork 前端设计提示词

将当前项目目录授权给 QoderWork，然后提交以下任务：

> 你是一名资深桌面生产力工具产品设计师和 React 前端工程师。请在当前工作目录中，为一个 Windows 键鼠自动化工具设计并实现可运行、可交互的前端原型。
>
> 产品定位：这是面向普通用户和效率工具用户的本地桌面工具，用于配置、录制、编辑和回放鼠标与键盘动作。它不是网页营销站；启动后直接进入实际工具界面。
>
> 首个可用版本包括：连点器、定时点击、键鼠录制、脚本编辑、脚本管理、脚本回放和全局急停。具体需求以当前项目的 `docs/project-tracker.md` 为准，实施前先完整阅读该文档。
>
> 信息架构：左侧窄导航栏包含控制台、连点器、录制、脚本和设置；顶部工具栏显示当前脚本名称、保存状态、全局状态和急停提示；主工作区显示当前功能；底部状态栏显示鼠标坐标、监听状态和执行状态。
>
> 重点设计脚本编辑器：左侧为占主要宽度的动作列表或时间线，右侧为所选动作属性编辑器；顶部提供新建、打开、保存、录制、运行、暂停和停止；支持新增、编辑、删除、复制、启用、禁用、排序、多选和批量删除；空状态提供“开始录制”和“手动添加动作”入口；运行时突出当前动作并显示整体进度。
>
> 视觉采用 Windows 桌面生产力工具风格，安静、专业、紧凑，适合长时间使用。默认浅色并支持深色。中性灰为基础，蓝色用于主要操作，绿色表示运行，琥珀色表示暂停，红色只用于停止、急停和危险操作。卡片圆角不超过 8px。使用分隔线、表格、工具栏、标签页和属性面板。不要使用营销 Hero、大面积插画、紫色渐变、装饰光球、玻璃拟态、胶囊控件或卡片嵌套。字号和控件密度应符合桌面工具。使用 Lucide 图标，图标按钮提供 tooltip。
>
> 技术要求：使用 React + TypeScript。先检查当前项目和已有依赖，不覆盖已有 Python 脚本。先实现前端原型，不连接真实键鼠控制 API。将系统能力定义为 typed service interface，并提供显式 `mock`/`real` 模式开关，默认使用 `mock`；不要在组件中散落模拟逻辑。主要按钮、输入框、菜单、标签页、弹窗、表格编辑、主题切换和导航必须可交互。不要实现登录、云同步、社区、付费和营销页面。
>
> 请先输出简短实施计划，然后创建或完善 React + TypeScript 前端；使用模拟数据演示录制、运行、暂停、继续、停止和急停；运行 lint、类型检查和生产构建并修复问题；启动本地预览；检查 1280×720、1440×900 和 1920×1080 下的重叠、溢出和布局跳动。最终说明启动命令、访问地址、修改文件和尚未接入的后端接口。
>
> 交付标准：首屏直接是可操作的控制台；用户无需阅读说明即可找到录制、运行和急停；脚本编辑器能够演示新增、编辑、删除、排序和启用或禁用；连点器参数完整且布局紧凑；危险操作有明确反馈；目标分辨率下无重叠和溢出；lint、TypeScript 类型检查和生产构建全部通过。

## 12. 文档维护规则

- 开始任务时，将对应复选框保持为未完成状态。
- 完成并验证后，将任务标记为 `[x]`。
- 需求变化必须同步更新 V1 范围、非目标和验收标准。
- 技术决策确定后，替换对应 `[TBD]` 并记录选择理由。
- 每次更新修改文档顶部的更新日期。