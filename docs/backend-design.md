# KeyMouse Studio 后端技术设计

> 文档状态：V1 开发基线  
> 更新日期：2026-07-14  
> 目标读者：后端开发、前端开发、测试与集成人员  
> 关联文档：`docs/project-tracker.md`

## 1. 目标与范围

后端负责 Windows 键鼠输入监听、录制、执行、脚本管理、配置持久化、全局急停和实时状态推送。React 前端只负责展示和交互，不得直接调用 `pynput`、Win32 API 或其他输入模拟库。

V1 后端提供：

- 连点器和定时点击。
- 键鼠事件录制、标准化和鼠标移动压缩。
- 版本化脚本校验、保存、加载和迁移。
- 脚本回放、暂停、继续、停止和急停。
- 实时状态、进度和错误事件。
- 应用设置、能力检测和运行诊断。

不提供云服务、账号、远程控制、脚本市场、图像识别和规避第三方限制能力。

## 2. 技术选型

### 2.1 固定方案

- Python 3.12。
- FastAPI 异步路由。
- Pydantic v2 请求、响应和持久化模型。
- Uvicorn 本地服务。
- REST 用于命令、查询和资源管理。
- WebSocket 用于状态、进度、录制动作和错误推送。
- `pytest`、`pytest-asyncio` 与 `httpx.AsyncClient` 用于测试。
- `pynput` 仅用于首阶段监听验证；回放优先使用 Windows `SendInput`。
- JSON 文件用于 V1 脚本和设置持久化。

### 2.2 本地通信决策

V1 使用 Electron 37 桌面外壳和仅绑定 `127.0.0.1` 的 FastAPI sidecar，前端通过 `RealAutomationService` 访问。Electron 主进程负责启动后端子进程、读取动态端口和一次性会话令牌，并在退出时关闭子进程。技术验证和选型依据见 `docs/technical-validation-a.md`。

选择该方案的原因：

- 与 React 前端和 Python 输入引擎边界清晰。
- REST/WebSocket 契约易于调试和测试。
- Electron 与现有 React/Vite 和 Node 工具链直接兼容，主进程可可靠管理 Python sidecar。
- 能显式区分 `mock` 和 `real`，避免混合实现。

安全约束：

- 禁止绑定 `0.0.0.0`。
- 启动时生成随机会话令牌，所有 REST 和 WebSocket 请求都必须校验。
- 不允许浏览器页面在缺少桌面外壳授权时直接调用输入能力。
- 会话令牌只存在于当前进程，不写入日志或仓库。

## 3. 目录结构

后端代码放在项目根目录 `backend/`：

    backend/
      pyproject.toml
      src/keymouse_studio/
        main.py
        config.py
        dependencies.py
        api/
          routers/
            health.py
            capabilities.py
            operations.py
            recording.py
            playback.py
            scripts.py
            settings.py
            events.py
          schemas/
            common.py
            actions.py
            scripts.py
            operations.py
            events.py
            settings.py
        domain/
          enums.py
          errors.py
          state_machine.py
          models.py
        services/
          operation_service.py
          clicker_service.py
          recording_service.py
          playback_service.py
          script_service.py
          settings_service.py
          event_service.py
          hotkey_service.py
        infrastructure/
          input/
            listener.py
            send_input.py
            key_registry.py
          persistence/
            json_script_repository.py
            json_settings_repository.py
          system/
            display_info.py
            privilege_info.py
            clock.py
      tests/
        unit/
        integration/
        contract/

分层规则：

- `routers` 只处理协议、鉴权、状态码和依赖注入。
- `schemas` 只定义 API 与持久化数据结构。
- `services` 编排用例，不直接依赖 FastAPI。
- `domain` 定义状态机、领域错误和不变量。
- `infrastructure` 封装 Win32、监听器、文件和系统信息。
- 测试通过接口或抽象替身隔离真实键鼠输入，CI 不执行真实点击。

## 4. 核心数据契约

### 4.1 时间与坐标

- 所有持续时间统一使用整数毫秒，字段名以 `Ms` 结尾。
- 持久化时间使用 UTC ISO 8601 字符串。
- 内部等待使用 `time.monotonic_ns()`，不得使用系统时间计算间隔。
- 鼠标坐标保存为 Windows 虚拟桌面的物理像素坐标。
- 脚本保存录制时显示器布局摘要；回放前发现布局变化时返回警告。

### 4.2 脚本模型

`schemaVersion` 初始值为 `1`。脚本模型：

    {
      "schemaVersion": 1,
      "id": "uuid",
      "name": "示例脚本",
      "description": "",
      "createdAt": "2026-07-14T06:00:00Z",
      "updatedAt": "2026-07-14T06:00:00Z",
      "settings": {
        "speedMultiplier": 1.0,
        "loopMode": "count",
        "loopCount": 1,
        "countdownMs": 3000
      },
      "actions": []
    }

脚本仓储元数据如 `lastUsedAt` 不写入脚本主体，由索引文件单独维护。

### 4.3 动作模型

动作采用可辨识联合类型，公共字段为：

    {
      "id": "uuid",
      "type": "mouse_click",
      "enabled": true,
      "delayBeforeMs": 100,
      "payload": {}
    }

V1 动作及 `payload`：

| 动作 | payload |
|---|---|
| `mouse_move` | `x`、`y`、可选 `durationMs` |
| `mouse_button_down` | `button` |
| `mouse_button_up` | `button` |
| `mouse_click` | `button`、`clickCount`、可选 `x`、`y`、`intervalMs` |
| `mouse_wheel` | `deltaX`、`deltaY` |
| `key_down` | `keyCode`、可选 `scanCode`、`extended` |
| `key_up` | `keyCode`、可选 `scanCode`、`extended` |
| `wait` | `durationMs` |

约束：

- `button` 只能为 `left`、`right`、`middle`。
- `clickCount` V1 只能为 `1` 或 `2`。
- `delayBeforeMs`、`durationMs` 和 `intervalMs` 不得为负数。
- 单个等待默认上限为 24 小时，可通过明确配置调整。
- 动作总数默认上限为 100000，超过时拒绝加载并返回结构化错误。
- 未识别动作不能静默忽略。

### 4.4 操作与状态

后端同一时间只允许一个独占操作：`clicker`、`timed_click`、`recording` 或 `playback`。

状态：

- `idle`
- `countdown`
- `recording`
- `running`
- `paused`
- `stopping`
- `error`

每次启动返回唯一 `operationId`。状态快照至少包含：

- `operationId`
- `operationType`
- `state`
- `sequence`
- `startedAt`
- `elapsedMs`
- `progress`
- `currentActionIndex`
- `completedCount`
- `countdownRemainingMs`
- `error`

`sequence` 在单个后端进程内严格递增。前端必须忽略旧 `operationId` 或更小 `sequence` 的事件。

### 4.5 错误模型

所有失败使用统一结构：

    {
      "error": {
        "code": "OPERATION_CONFLICT",
        "message": "已有任务正在运行",
        "details": {},
        "retryable": false,
        "operationId": "uuid-or-null"
      }
    }

首批错误码：

- `VALIDATION_ERROR`
- `UNAUTHORIZED_LOCAL_CLIENT`
- `OPERATION_CONFLICT`
- `INVALID_STATE_TRANSITION`
- `SCRIPT_NOT_FOUND`
- `SCRIPT_VERSION_UNSUPPORTED`
- `HOTKEY_REGISTRATION_FAILED`
- `INPUT_PERMISSION_DENIED`
- `DISPLAY_LAYOUT_CHANGED`
- `ENGINE_INTERNAL_ERROR`

异常堆栈只写本地诊断日志，不直接返回前端。

## 5. API 设计

统一前缀为 `/api/v1`。除健康检查外，均要求 `Authorization: Bearer <session-token>`。

### 5.1 健康与能力

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/health` | 进程存活、版本和协议版本 |
| GET | `/capabilities` | Windows 版本、权限、显示器、DPI、热键和输入能力 |
| GET | `/state` | 获取最新完整状态快照 |
| WS | `/events` | 订阅状态、动作、警告和错误事件 |

### 5.2 连点器

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/clicker/start` | 启动连点器并返回 `operationId` |
| POST | `/operations/{id}/pause` | 暂停 |
| POST | `/operations/{id}/resume` | 继续 |
| POST | `/operations/{id}/stop` | 正常停止 |

启动参数包含 `button`、`clickCount`、`intervalMs`、`repeatMode`、`repeatCount`、`positionMode`、可选 `x` 和 `y`、`countdownMs`。

### 5.3 定时点击

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/timed-click/start` | 启动定时点击 |
| POST | `/operations/{id}/pause` | 暂停 |
| POST | `/operations/{id}/resume` | 继续 |
| POST | `/operations/{id}/stop` | 停止 |

参数包含 `delayMs`、`intervalMs`、`repeatMode`、`repeatCount`、`button`、`clickCount`、`positionMode` 和坐标。单次模式使用 `repeatCount = 1`。

### 5.4 录制

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/recordings/start` | 启动录制 |
| POST | `/operations/{id}/pause` | 暂停录制 |
| POST | `/operations/{id}/resume` | 继续录制 |
| POST | `/operations/{id}/stop` | 停止并返回录制结果引用 |
| GET | `/recordings/{id}` | 获取录制结果和动作 |

录制配置包含是否记录鼠标移动、最小采样间隔、移动压缩误差、是否记录滚轮和允许的设备类型。

### 5.5 回放

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/playback/start` | 校验脚本并启动回放 |
| POST | `/operations/{id}/pause` | 暂停 |
| POST | `/operations/{id}/resume` | 继续 |
| POST | `/operations/{id}/stop` | 正常停止 |

参数使用 `scriptId` 或内联脚本二选一，并支持 `speedMultiplier`、`loopMode`、`loopCount`、`loopDurationMs` 和 `countdownMs`。

### 5.6 急停

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/emergency-stop` | 触发急停并等待安全释放确认 |

全局热键直接在后端触发同一领域用例，不经过前端。接口返回急停结果和已释放输入数量。

### 5.7 脚本

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/scripts/validate` | 校验脚本并返回字段级错误 |
| POST | `/scripts` | 创建脚本 |
| GET | `/scripts` | 查询脚本列表 |
| GET | `/scripts/{id}` | 获取脚本 |
| PUT | `/scripts/{id}` | 完整更新脚本 |
| POST | `/scripts/{id}/duplicate` | 复制脚本 |
| DELETE | `/scripts/{id}` | 删除脚本 |

写操作返回持久化后的完整脚本，不能只返回 `void`。

### 5.8 设置

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/settings` | 获取设置 |
| PUT | `/settings` | 校验并完整更新设置 |
| POST | `/hotkeys/validate` | 检查热键格式与占用情况 |

`serviceMode` 是前端连接策略，不属于后端持久化业务设置。

## 6. WebSocket 事件

事件信封：

    {
      "protocolVersion": 1,
      "eventId": "uuid",
      "sequence": 42,
      "timestamp": "2026-07-14T06:00:00Z",
      "operationId": "uuid-or-null",
      "type": "operation.state_changed",
      "payload": {}
    }

V1 事件：

- `engine.ready`
- `engine.capabilities_changed`
- `operation.state_changed`
- `operation.progress`
- `recording.action_captured`
- `recording.snapshot`
- `hotkey.status_changed`
- `warning.raised`
- `error.raised`

连接成功后，服务端必须先发送完整状态快照，再发送增量事件。前端断线重连后调用 `/state` 对齐状态，不依赖补发全部历史事件。

## 7. 并发与计时模型

### 7.1 线程边界

- FastAPI 和 WebSocket 运行在 asyncio 事件循环。
- `pynput` 监听器运行在专用线程。
- `SendInput` 执行器运行在单个专用工作线程，确保动作顺序。
- 线程与 asyncio 之间通过有界线程安全队列通信。
- 任何 Win32 回调不得直接修改 FastAPI 状态或调用 WebSocket。

### 7.2 取消与暂停

每个操作持有：

- `cancel_event`
- `pause_event`
- `operation_id`
- 单调时钟基准
- 当前仍按下的键和鼠标按钮集合

长等待必须拆分为可取消等待，急停检测延迟目标不超过 50ms。暂停期间不累计脚本逻辑时间；恢复后从剩余等待时长继续，不重放已完成动作。

### 7.3 状态一致性

- 状态转换由单一 `OperationService` 串行化。
- 路由不能直接修改状态。
- 同一时间只允许一个独占操作。
- 停止接口应幂等；重复停止同一操作返回最终状态。
- 未匹配当前 `operationId` 的暂停、继续或停止请求返回冲突错误。

## 8. 输入安全设计

### 8.1 急停流程

1. 原子设置取消标志。
2. 阻止执行器接收新动作。
3. 清空尚未执行的动作队列。
4. 释放后端记录为按下状态的所有键和鼠标按钮。
5. 停止监听器或录制器。
6. 发布 `stopping` 状态和释放结果。
7. 确认工作线程退出后回到 `idle`。

即使释放某个输入失败，也必须继续尝试释放其他输入，并在最终事件中报告失败项。

### 8.2 权限与显示器

- 启动时检测当前进程完整性级别。
- 目标窗口权限高于本进程时，返回明确警告，不尝试规避系统限制。
- 进程启动时设置 DPI awareness，再读取坐标。
- 保存虚拟桌面边界、显示器标识、分辨率和缩放摘要。
- 坐标落在当前虚拟桌面之外时拒绝执行。

### 8.3 脚本与配置文件

- 只允许访问应用数据目录和用户明确选择的文件。
- 脚本文件名不能直接拼接成路径。
- 保存使用临时文件加原子替换，避免中断导致损坏。
- 限制文件大小、动作数量和字符串长度。
- 不执行脚本中的任意 Python、Shell 或 JavaScript 内容。

## 9. 前端契约迁移

当前 `react-vite/src/types.ts` 是 Mock 原型，后端编码前需同步以下变更：

1. `mouse_scroll` 统一改为 `mouse_wheel`。
2. 增加 `mouse_button_down` 和 `mouse_button_up`。
3. `ScriptAction.delay` 改为 `delayBeforeMs`。
4. 动作参数改为按 `type` 区分的 `payload` 联合类型。
5. `Script` 增加 `schemaVersion` 和 `settings`。
6. 统一运行状态，删除持久化的 `stopped` 和 `emergency`；急停是命令和事件，不是稳定状态。
7. 增加 `operationId`、`operationType`、`sequence` 和结构化 `error`。
8. `IAutomationService` 的真实方法改为异步 `Promise`，写操作返回服务端结果。
9. 定时点击增加暂停、继续和固定次数。
10. 增加脚本校验、能力检测、热键状态和 WebSocket 重连能力。

迁移原则：

- 先新增共享契约和适配层，再迁移页面，避免一次性破坏前端原型。
- `MockAutomationService` 与 `RealAutomationService` 必须实现同一个异步接口。
- 模式切换必须重建服务实例并断开旧订阅，不允许 Real 失败后静默回退 Mock。
- Real 连接失败时显示明确错误，并保留用户手动切回 Mock 的选择。

## 10. 测试策略

### 10.1 单元测试

- 状态机合法和非法转换。
- 暂停、恢复、取消和剩余时间计算。
- 动作模型校验。
- 脚本版本校验和迁移。
- 鼠标移动压缩。
- 按键状态登记与安全释放。
- JSON 原子保存和损坏文件恢复。

### 10.2 API 集成测试

使用 FastAPI 应用工厂、依赖覆盖和 `httpx.AsyncClient`：

- 鉴权成功与失败。
- 各启动命令返回 `operationId`。
- 操作冲突返回 `409`。
- 非法状态转换返回 `409`。
- 脚本 CRUD 和字段级校验错误。
- 停止与急停幂等性。
- 设置更新和热键冲突。

### 10.3 WebSocket 契约测试

- 首帧为完整状态快照。
- `sequence` 单调递增。
- 事件带正确 `operationId`。
- 慢客户端不会阻塞输入工作线程。
- 断线不会停止当前操作。
- 重连后可通过 `/state` 恢复一致状态。

### 10.4 Windows 集成测试

真实输入测试只在显式标记环境运行：

- 监听鼠标、键盘和组合键。
- `SendInput` 点击、按键和滚轮。
- F12 全局急停。
- 多显示器及 100%、125%、150% 缩放。
- 普通权限和管理员权限目标窗口。
- 急停后无残留按键。

默认 `pytest` 禁止产生真实输入。

## 11. 可观测性

- 使用结构化本地日志，默认不记录具体键盘字符。
- 日志包含 `operationId`、状态转换、耗时、错误码和线程退出结果。
- 不记录会话令牌、脚本完整内容或敏感输入序列。
- 日志轮转并限制总大小。
- `/health` 返回应用版本、协议版本和引擎状态，不返回敏感配置。

## 12. 开发顺序

### 里程碑 B0：工程骨架

- 建立 `backend/` 包、FastAPI 应用工厂和配置。
- 建立统一响应、错误、鉴权和依赖注入。
- 实现 `/health`、`/capabilities` 和 `/events` 骨架。
- 配置 pytest、async 测试和静态检查。

完成定义：后端可启动，健康检查、鉴权和 WebSocket 首帧测试通过。

### 里程碑 B1：领域契约

- 实现脚本和动作 Pydantic 模型。
- 实现状态机、`operationId` 和事件信封。
- 实现脚本仓储及版本迁移框架。
- 输出与前端一致的 OpenAPI/类型契约。

完成定义：Schema、状态机、仓储和 API 契约测试通过。

### 里程碑 B2：连点与定时点击

- 封装单调计时、暂停和取消。
- 实现 `SendInput` 适配器。
- 实现连点和定时点击服务。
- 实现停止与急停安全释放。

完成定义：Fake 输入适配器测试全部通过，Windows 显式集成测试通过。

### 里程碑 B3：录制与回放

- 实现输入监听器和录制标准化。
- 实现鼠标移动压缩。
- 实现脚本回放和进度事件。
- 实现异常恢复与释放确认。

完成定义：可录制、保存、加载并回放一段键鼠脚本，F12 可全程急停。

### 里程碑 B4：前后端与 Electron 联调

- 实现前端 `RealAutomationService`。
- 完成 mock/real 显式切换。
- 对齐错误、状态和事件展示。
- Electron 主进程启动打包后的 FastAPI sidecar，读取 stdout 单行 JSON 握手中的动态端口和令牌。
- BrowserWindow 固定关闭 Node integration，并启用 context isolation 和 sandbox。
- preload 仅暴露读取连接信息的窄接口。
- 覆盖正常退出、sidecar 崩溃、动态端口占用、中文安装路径和令牌拒绝测试。
- 完成端到端核心流程测试。

完成定义：前端可真实执行连点、录制和回放；连接失败不会静默回退 Mock；Electron 退出后 sidecar 不残留；无令牌本地请求不能调用受保护接口。

## 13. 后端完成标准

- FastAPI 仅监听本机并验证会话令牌。
- REST、WebSocket、Schema 和错误模型有自动化测试。
- 所有操作具有 `operationId`，状态事件具有递增 `sequence`。
- 同一时间只运行一个独占操作。
- 暂停和恢复不会重放已完成动作。
- 急停检测延迟达到目标，且完成安全释放。
- 脚本损坏、版本不支持和字段非法时不会开始执行。
- 默认测试不会产生真实键鼠输入。
- lint、类型检查和 pytest 全部通过。
- 前端 Real 模式与 Mock 模式严格互斥。