# 阶段 A Windows 技术验证记录

> 验证日期：2026-07-14  
> 验证平台：Windows 11 AMD64、Python 3.12.7、Node.js 22.12.0  
> 结论：核心技术路径通过，V1 桌面方案冻结为 Electron

## 1. 冻结方案

V1 使用 Electron 37 + React/Vite 渲染进程 + 独立 Python/FastAPI sidecar。

- Electron 主进程负责启动和回收 sidecar。
- sidecar 仅绑定 `127.0.0.1:0`，启动后通过 stdout 单行 JSON 返回动态端口和进程级随机令牌。
- `BrowserWindow` 固定启用 `nodeIntegration: false`、`contextIsolation: true` 和 `sandbox: true`。
- preload 只暴露读取连接信息的窄接口，不暴露文件、Shell 或任意进程调用。
- REST 和 WebSocket 均使用一次性令牌鉴权；令牌不持久化、不写日志。
- 开发态使用系统 Python，发布态将后端打包为 Windows sidecar 可执行文件。

未选择 Tauri：当前环境未安装 Rust，Python sidecar 的构建、签名和资源路径会引入额外工具链风险。未选择 pywebview：它会弱化既定的桌面外壳、React 客户端和独立本地服务边界。

## 2. 自动化验证结果

| 验证项 | 结果 | 证据 |
|---|---|---|
| 暂停后恢复时间语义 | 通过 | 单调纳秒时钟模型在暂停期间不扣减剩余时长，恢复后从剩余等待继续 |
| 虚拟桌面坐标归一化 | 通过 | 覆盖负原点、边界值、越界拒绝和 `0..65535` 映射 |
| 显示器布局摘要 | 通过 | 显示器枚举顺序不影响摘要，布局变化会改变摘要 |
| 权限边界判定 | 通过 | Medium 到 High/System 的静态判定被拒绝，不包含提权或绕过路径；管理员窗口实机矩阵留待发布复验 |
| 急停安全释放 | 通过 | 单项释放失败后继续释放其余登记输入，并清空登记状态 |
| 默认测试输入隔离 | 通过 | Windows 和真实输入测试需要独立参数及确认环境变量 |
| Electron sidecar 生命周期 | 通过 | 随机端口、无令牌 401、有效令牌 200、退出回收均通过 |
| Electron 窗口启动 | 阻塞 | Electron 二进制下载发生 `ECONNRESET`；不影响 Node sidecar 核心验证 |

默认测试结果：`43 passed, 3 skipped`。Ruff 和 mypy strict 均通过。

## 3. 显式真实输入验证

受控探针使用 `SendInput` 合成 F12、绝对坐标移动、左键点击和滚轮，并由 `pynput` 全局监听器接收：

- 全局键盘和鼠标监听成功。
- F12 按下和释放顺序正确。
- 从发送到 F12 监听回调的延迟不超过 50ms。
- 绝对坐标移动、左键按下/释放和滚轮均被监听器接收。
- 监听线程在收到 F12 后正常退出。
- 输入登记在释放后为空，鼠标位置在测试结束后恢复。

真实输入测试默认跳过，只有同时提供以下参数才执行：

```powershell
$env:KEYMOUSE_REAL_INPUT_ACK="I_UNDERSTAND"
python -m pytest tests/probes/test_real_input_probe.py `
  --run-windows-probes --allow-real-input -v
```

## 4. 本机系统快照

- DPI awareness：已启用 Per-Monitor V2。
- 虚拟桌面：`left=-2560, top=0, width=5120, height=1440`。
- 显示器：2 块，均为 `2560x1440`，副屏位于主屏左侧。
- 当前进程完整性：Medium。
- 验证时前台进程完整性：Medium。

## 5. 保留的发布矩阵

阶段 A 已确认技术路径，但以下环境组合必须在 B2/B3 正式适配器完成后、D 阶段发布前复验：

- `SendInput` 右键、中键和完整脚本动作序列。
- 100%、125%、150% 缩放分别命中目标网格。
- 不同分辨率和显示器布局变化提示。
- 普通权限进程面对管理员权限目标窗口时返回明确警告。
- 连续 20 次 F12 的最大值和 P95 延迟。
- 后端异常退出、Electron 异常退出和安装包环境下的 sidecar 回收。

这些项目属于正式实现和发布验收，不改变 Electron 桌面方案冻结结论。