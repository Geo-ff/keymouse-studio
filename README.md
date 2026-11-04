<p align="center">
  <img src="react-vite/public/keyboard-studio-logo.png" alt="KeyMouse Studio" width="128" height="128" />
</p>

<h1 align="center">KeyMouse Studio</h1>

<p align="center">
  面向 Windows 的本地键鼠自动化工具<br />
  连点 · 定时 · 录制回放 · 一键快捷键，针对游戏做了专门适配
</p>

<p align="center">
  <a href="./README.en.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/Geo-ff/keymouse-studio/releases/latest"><img src="https://img.shields.io/github/v/release/Geo-ff/keymouse-studio?display_name=tag&sort=semver&label=release" alt="Release" /></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11%20x64-0078D4?logo=windows&logoColor=white" alt="Platform" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
  <a href="https://github.com/Geo-ff/keymouse-studio/stargazers"><img src="https://img.shields.io/github/stars/Geo-ff/keymouse-studio?style=flat" alt="Stars" /></a>
  <a href="https://github.com/Geo-ff/keymouse-studio/issues"><img src="https://img.shields.io/github/issues/Geo-ff/keymouse-studio" alt="Issues" /></a>
</p>

## 亮点

- **录一遍，按一下就重放**：把键鼠操作录成脚本，再给常用脚本设一个快捷键，在任何窗口按一下运行、再按一下停止，不用切回软件
- **游戏里也能用**：按键以硬件扫描码发送，点击会按住约 30 ms，多数读取 DirectInput / Raw Input 的游戏也能识别；第一 / 第三人称游戏可以录制和回放视角转动
- **连点随开随停**：给连点器设一个开关键，在游戏里按一下开始、再按一下停止；鼠标、键盘都能连点
- **到点自动执行**：等待一段时间或到指定时刻（可每天重复），自动点击、按键或运行一个脚本
- **跑完回到原位**：脚本最后加一个「回到记录位置」，运行结束后鼠标回到启动前指着的地方
- **不挡视线，随时可停**：主窗口可以缩到托盘继续运行，置顶小窗浮在游戏上方显示进度；任何时候按 **F12** 急停

## 下载安装

1. 打开 [最新版本 Release](https://github.com/Geo-ff/keymouse-studio/releases/latest)
2. 下载 **`KeyMouse-Studio-Setup-*.exe`**
3. 双击安装并启动 **KeyMouse Studio**

若 GitHub 访问较慢，可使用 [国内备用下载（夸克网盘）](./docs/domestic-download.md)。

**系统要求**：Windows 10 / 11（x64）

**说明**：

- 安装包内已包含运行所需组件，**无需**自行安装 Python
- 当前安装包可能**未做代码签名**，Windows SmartScreen 可能提示未知应用：选择「更多信息」→「仍要运行」
- 建议优先从本仓库的 GitHub Releases 下载；国内网络不便时再使用夸克网盘备用源
- **请认准官方来源**：GitHub 用户 `Geo-ff` / 仓库 `keymouse-studio`

## 快速上手

### 连点

1. 打开 **连点器**，选择鼠标或键盘，设置间隔和次数后点「开始」（启动前有倒计时，方便切换到目标窗口）
2. 想在游戏里直接开关：在 **设置 → 全局快捷键** 里设置「连点器开关」，之后在任何窗口按一下开始、再按一下停止（快捷键启动不倒计时）

### 录一段操作，反复执行

1. 打开 **录制**，点开始，把要重复的操作做一遍，再停止录制
2. 保存为脚本，可以在 **脚本** 编辑器里调整动作、延迟、循环次数和速度
3. 在 **脚本** 列表的「快捷键」一栏给它设一个快捷键，回到目标窗口按一下运行、再按一下停止

> 小技巧：3D 游戏转视角时，录制前把「鼠标移动录制方式」切换为「游戏视角（相对移动）」；希望脚本跑完鼠标回到原处，就在脚本最后加一个「回到记录位置」动作。

### 定时执行

打开 **定时**，选择「等待一段时间」或「指定时刻」（可每天重复），再选到点后要做什么：点击鼠标、按下按键或运行脚本。

### 随时停下

- 任何时候按 **F12**（可在设置中修改）或点顶栏的「急停」，立即停止所有操作，并尽量松开已按下的键鼠
- 在 **设置 → 全局快捷键** 里还可以设置「暂停 / 继续」，对连点、定时、录制和回放都有效

## 全部功能

| 功能 | 能做什么 |
| --- | --- |
| 连点器 | 鼠标或键盘连点，按次数或持续运行，点击指定坐标或当前位置；可设开关快捷键 |
| 定时 | 等待一段时间或到指定时刻（可每天重复）后点击鼠标、按下按键或运行脚本 |
| 录制 | 记录键鼠操作并生成可编辑脚本；「游戏视角（相对移动）」模式可以录下 3D 游戏的视角转动 |
| 脚本编辑 | 增删改动作、拖拽排序、启用 / 禁用；组合键、视角移动、「记录鼠标位置 / 回到记录位置」；撤销 / 重做（Ctrl+Z / Ctrl+Y）、复制粘贴动作、Ctrl+S 保存 |
| 脚本回放 | 设置速度、循环次数或时长，支持暂停 / 继续 / 停止 |
| 脚本管理 | 保存、复制、删除本地脚本；列表中一键运行，为常用脚本单独设置快捷键；导入 / 导出 .json 文件分享脚本 |
| 全局快捷键 | 急停、开始 / 停止录制、开始 / 停止回放、连点器开关、暂停 / 继续，以及每个脚本自己的快捷键，在任何窗口都能用 |
| 安全控制 | 全局急停，尽量释放已按下的键鼠；目标窗口权限更高时自动暂停并提示 |
| 托盘与小窗 | 关闭主窗口时可最小化到托盘继续运行；置顶小窗在游戏上方显示当前任务，并可暂停、停止、急停 |
| 自动更新 | 启动后检查新版本，「关于」页面一直显示新版本的更新内容；更新后第一次启动会告诉你这次更新了什么 |

**当前版本不包含**：云同步、账号、在线脚本市场、macOS / Linux、图像识别 / OCR 等。

## 演示视频

### 展示视频

<p align="center">
  <img src="docs/assets/demo-showcase.gif" alt="KeyMouse Studio 展示视频" width="720" />
</p>

### 实机演示

<p align="center">
  <img src="docs/assets/demo-real.gif" alt="KeyMouse Studio 实机演示" width="720" />
</p>

## 在游戏中不生效？

- **以管理员身份运行**：很多游戏（或它的启动器）以管理员权限运行，Windows 会拦截普通权限程序发出的键鼠输入。此时任务会自动暂停并提示；请右键 KeyMouse Studio →「以管理员身份运行」后重试
- **按键与点击**：按键以硬件扫描码发送，鼠标点击会按住一小段时间（约 30 ms），以便读取 DirectInput / Raw Input 或逐帧检测输入的游戏能够识别。旧版本录制的脚本无需重新录制
- **3D 视角转动**：第一/第三人称游戏用鼠标的相对位移控制视角，光标坐标对它无效。录制前在录制页把「鼠标移动录制方式」切换为「游戏视角（相对移动）」；也可以在脚本编辑器中手动添加「视角移动」动作，设置位移和时长。录制时记录的是鼠标原始位移，回放效果还受游戏内灵敏度影响，录制和回放时请保持相同的灵敏度设置
- **快捷键在某个游戏里没反应**：少数游戏会屏蔽系统级快捷键。可以先切出游戏用界面按钮操作；急停（默认 F12）使用另一种按键监听方式，通常仍然有效。欢迎通过 Issue 反馈具体是哪个游戏
- **带反作弊的游戏**：部分游戏会主动忽略软件模拟的输入，本工具不提供任何绕过手段；在这类游戏中使用自动化也可能违反其用户协议，请自行确认

## 自动更新

- 使用官方安装包时，启动后会在后台检查 [GitHub Releases](https://github.com/Geo-ff/keymouse-studio/releases) 是否有新版本
- 发现新版本时会弹出一次更新内容，侧边栏「关于」出现红点；**关于** 页面会一直显示新版本的完整更新内容，可以在那里下载并查看进度
- 下载完成后可以立即重启安装；也可以稍后，下次退出 KeyMouse Studio 时会自动完成安装
- 更新后第一次启动会显示一次这次更新了什么（跳过的版本也会一起列出）
- 也可以在 **关于** 页面或菜单 **文件 → 关于与检查更新** 中手动检查

## 使用注意

- 本工具在**本机**模拟键鼠输入，请仅在你有权操作的环境中使用
- 请遵守操作系统、游戏、网站或软件的服务条款与当地法律法规；因滥用造成的后果由使用者自行承担
- 脚本数据保存在本地，应用**不会**把你的脚本上传到云端
- 急停快捷键可在设置中调整；执行重要操作前建议先确认急停可用
- 设为全局快捷键的按键会被系统级占用：在游戏和其他程序里按下它只会触发 KeyMouse Studio，不再输入原来的内容。建议使用 F 键或 Ctrl / Alt 组合键
- 脚本快捷键和列表中的运行按钮运行的是**已保存**的脚本，编辑器里的修改要先保存才会生效
- 导入别人分享的脚本后，请先在编辑器里检查动作再运行：脚本可以执行任何键鼠操作
- 关闭主窗口时可以选择「最小化到托盘」，此时程序仍在运行；要彻底退出，请右键托盘图标选择「退出」，或在「设置 → 系统」里把关闭行为改为「退出程序」

## 支持项目

本项目坚持免费开源，由个人利用业余时间持续开发和维护。制作不易，点个 [Star](https://github.com/Geo-ff/keymouse-studio) 就是对我努力最大的支持。

## 社区认可

感谢 [LINUX DO](https://linux.do) 社区为开源项目提供友好、开放的交流环境，也感谢社区成员对 KeyMouse Studio 的关注与支持。

## 反馈

遇到问题或有建议，欢迎通过以下方式反馈：

- 提交 [GitHub Issue](https://github.com/Geo-ff/keymouse-studio/issues)
- 使用微信扫描下方二维码，加入 **KeyMouse Studio 使用反馈群**

<p align="center">
  <img src="docs/assets/wechat-feedback-group.png" alt="KeyMouse Studio 使用反馈微信群二维码" width="360" />
</p>

> 微信群二维码将在 **2026 年 11 月 11 日前**有效；若二维码失效，请通过 GitHub Issue 联系维护者更新。

## 开发者

若你要改代码、跑测试或自己打包安装包，请阅读：

- [开发与构建说明](./docs/development.md)
- [项目跟踪](./docs/project-tracker.md)
- [后端设计](./docs/backend-design.md)

技术栈概览：Electron · React · TypeScript · Python（FastAPI）

## 许可证

本项目采用 [MIT License](./LICENSE) 开源。
