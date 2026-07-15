import { app, dialog, Menu, shell } from 'electron'
import {
  APP_DESCRIPTION,
  APP_TITLE,
  GITHUB_REPO_URL,
  ALLOWED_EXTERNAL_URLS,
  getAppTitle,
} from './constants.mjs'
import {
  checkForUpdates,
  getUpdateMenuLabel,
  onUpdateMenuStatus,
} from './auto-updater.mjs'

export { getAppTitle }

async function openAllowedExternal(url) {
  if (!ALLOWED_EXTERNAL_URLS.includes(url)) {
    throw new Error('blocked external url')
  }
  await shell.openExternal(url)
}

export function showAboutDialog() {
  const version = app.getVersion()
  return dialog.showMessageBox({
    type: 'info',
    title: `关于 ${APP_TITLE}`,
    message: APP_TITLE,
    detail: [
      `当前版本：v${version}`,
      APP_DESCRIPTION,
      '',
      `官方仓库：${GITHUB_REPO_URL}`,
    ].join('\n'),
  })
}

export function createAppMenu() {
  const template = [
    {
      label: '文件',
      submenu: [{ label: '退出', role: 'quit' }],
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
      label: `关于 ${APP_TITLE}`,
      submenu: [
        {
          label: `关于 ${APP_TITLE}`,
          click: () => {
            void showAboutDialog()
          },
        },
        {
          label: `当前版本：v${app.getVersion()}`,
          enabled: false,
        },
        {
          id: 'check-for-updates',
          label: getUpdateMenuLabel(),
          click: () => {
            void checkForUpdates({ silent: false })
          },
        },
        { type: 'separator' },
        {
          label: 'GitHub 仓库',
          click: () => {
            void openAllowedExternal(GITHUB_REPO_URL)
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)

  onUpdateMenuStatus((label) => {
    const item = menu.getMenuItemById('check-for-updates')
    if (item) item.label = label
  })

  return menu
}
