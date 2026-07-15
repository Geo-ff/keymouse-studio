import { dialog, Menu, shell } from 'electron'

const APP_TITLE = 'KeyBoard Studio'

export function getAppTitle() {
  return APP_TITLE
}

export function createAppMenu() {
  return Menu.buildFromTemplate([
    {
      label: '文件',
      submenu: [
        { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '强制重新加载', role: 'forceReload' },
        { label: '切换开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '切换全屏', role: 'togglefullscreen' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '缩放', role: 'zoom' },
        { type: 'separator' },
        { label: '关闭', role: 'close' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: `关于 ${APP_TITLE}`,
          click: async () => {
            await dialog.showMessageBox({
              type: 'info',
              title: '关于',
              message: APP_TITLE,
              detail: '键鼠自动化工具 — 连点、录制、脚本编辑与回放',
            })
          },
        },
        {
          label: '学习更多',
          click: async () => {
            await shell.openExternal('https://www.electronjs.org')
          },
        },
      ],
    },
  ])
}