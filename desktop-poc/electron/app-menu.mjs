import { Menu } from 'electron'
import { APP_TITLE, getAppTitle } from './constants.mjs'

export { getAppTitle }

/** @type {(() => void) | null} */
let openAboutHandler = null

export function setMenuUiHandlers({ onOpenAbout } = {}) {
  openAboutHandler = typeof onOpenAbout === 'function' ? onOpenAbout : null
}

function openAbout() {
  if (openAboutHandler) openAboutHandler()
}

export function createAppMenu() {
  // Windows/Linux 顶栏菜单项必须带 submenu，无法做成“单击无下拉”。
  // 因此不设顶栏「关于」菜单，避免重复子菜单；关于入口放在「文件」下单层项。
  // 应用内工具栏另有一键「关于」按钮。
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: `关于与检查更新`,
          click: () => openAbout(),
        },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
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
  ]

  return Menu.buildFromTemplate(template)
}
