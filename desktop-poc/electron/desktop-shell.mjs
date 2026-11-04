import { app, BrowserWindow, dialog, Menu, nativeImage, Notification, screen, Tray } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  CLOSE_BEHAVIORS,
  DEFAULT_DESKTOP_PREFS,
  normalizeDesktopPrefs,
  positionOnScreen,
  trayTooltip,
} from './desktop-utils.mjs'

// Tray icon, "close to tray" behaviour and the always-on-top mini status window.

const MINI_SIZE = Object.freeze({ width: 320, height: 132 })

let options
let prefs = normalizeDesktopPrefs(DEFAULT_DESKTOP_PREFS)
let prefsPath
let tray
let miniWindow
let statusText = '空闲'
let savePositionTimer

function prefsFile() {
  prefsPath ??= path.join(app.getPath('userData'), 'desktop-prefs.json')
  return prefsPath
}

async function loadPrefs() {
  try {
    prefs = normalizeDesktopPrefs(JSON.parse(await readFile(prefsFile(), 'utf8')))
  } catch {
    prefs = normalizeDesktopPrefs(DEFAULT_DESKTOP_PREFS)
  }
}

async function savePrefs() {
  try {
    await mkdir(path.dirname(prefsFile()), { recursive: true })
    await writeFile(prefsFile(), `${JSON.stringify(prefs, null, 2)}\n`, 'utf8')
  } catch (error) {
    console.error('failed to save desktop prefs', error)
  }
}

export function getDesktopPrefs() {
  return { closeBehavior: prefs.closeBehavior, miniVisible: isMiniVisible() }
}

export async function setDesktopPrefs(update = {}) {
  if (CLOSE_BEHAVIORS.includes(update.closeBehavior)) prefs.closeBehavior = update.closeBehavior
  await savePrefs()
  rebuildTrayMenu()
  return getDesktopPrefs()
}

function mainWindow() {
  const window = options?.getMainWindow()
  return window && !window.isDestroyed() ? window : undefined
}

export function showMainWindow() {
  const window = mainWindow()
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

function sendAction(actionId) {
  options?.sendToMain('hotkeys:action', { actionId })
}

/* --- Tray --- */

function trayImage() {
  const image = nativeImage.createFromPath(options.icon)
  return image.isEmpty() ? image : image.resize({ width: 16, height: 16 })
}

function rebuildTrayMenu() {
  if (!tray || tray.isDestroyed()) return
  const behaviorItem = (value, label) => ({
    label,
    type: 'radio',
    checked: prefs.closeBehavior === value,
    click: () => { void setDesktopPrefs({ closeBehavior: value }) },
  })
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示主窗口', click: showMainWindow },
    { label: '置顶小窗', type: 'checkbox', checked: isMiniVisible(), click: () => toggleMiniWindow() },
    { type: 'separator' },
    { label: '暂停 / 继续', click: () => sendAction('pauseToggle') },
    { label: '停止当前任务', click: () => sendAction('stopActive') },
    { label: '急停', click: () => sendAction('emergency') },
    { type: 'separator' },
    {
      label: '关闭主窗口时',
      submenu: [
        behaviorItem('ask', '每次询问'),
        behaviorItem('tray', '最小化到托盘'),
        behaviorItem('quit', '退出程序'),
      ],
    },
    { type: 'separator' },
    { label: '退出 KeyMouse Studio', click: () => app.quit() },
  ]))
}

function createTray() {
  try {
    tray = new Tray(trayImage())
  } catch (error) {
    // Some Linux desktops have no tray; the app still works without it.
    console.error('tray unavailable', error)
    tray = undefined
    return
  }
  tray.setToolTip(trayTooltip(statusText))
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
  rebuildTrayMenu()
}

export function setShellStatus(text) {
  statusText = typeof text === 'string' ? text.slice(0, 200) : '空闲'
  if (tray && !tray.isDestroyed()) tray.setToolTip(trayTooltip(statusText))
}

/* --- Closing the main window --- */

async function hideToTray(window) {
  window.hide()
  if (!tray && !isMiniVisible()) {
    // Nowhere to come back from: quit instead of leaving an invisible app running.
    app.quit()
    return
  }
  if (!prefs.trayHintShown) {
    prefs.trayHintShown = true
    void savePrefs()
    if (Notification.isSupported()) {
      new Notification({
        title: 'KeyMouse Studio 仍在运行',
        body: '已最小化到托盘，快捷键和定时任务会继续工作。右键托盘图标可以退出。',
        icon: options.icon,
      }).show()
    }
  }
}

/** Call from the main window's "close" event while the app is not quitting. */
export async function handleMainWindowClose(event, window) {
  event.preventDefault()
  if (prefs.closeBehavior === 'tray') {
    await hideToTray(window)
    return
  }
  if (prefs.closeBehavior === 'quit') {
    app.quit()
    return
  }
  const { response, checkboxChecked } = await dialog.showMessageBox(window, {
    type: 'question',
    title: '关闭 KeyMouse Studio',
    message: '关闭主窗口时要怎么做？',
    detail: '最小化到托盘后，快捷键、定时任务和正在运行的脚本会继续工作。以后可以在「设置」或托盘菜单里修改。',
    buttons: ['最小化到托盘', '退出程序', '取消'],
    defaultId: 0,
    cancelId: 2,
    checkboxLabel: '记住我的选择',
    noLink: true,
  })
  if (response === 2) return
  const behavior = response === 0 ? 'tray' : 'quit'
  if (checkboxChecked) await setDesktopPrefs({ closeBehavior: behavior })
  if (behavior === 'tray') await hideToTray(window)
  else app.quit()
}

/* --- Mini window --- */

export function isMiniVisible() {
  return Boolean(miniWindow && !miniWindow.isDestroyed() && miniWindow.isVisible())
}

function defaultMiniPosition() {
  const area = screen.getPrimaryDisplay().workArea
  return { x: area.x + area.width - MINI_SIZE.width - 16, y: area.y + 16 }
}

function rememberMiniPosition() {
  clearTimeout(savePositionTimer)
  savePositionTimer = setTimeout(() => {
    if (!miniWindow || miniWindow.isDestroyed()) return
    const [x, y] = miniWindow.getPosition()
    prefs.mini = { ...prefs.mini, x, y }
    void savePrefs()
  }, 400)
}

function createMiniWindow() {
  const areas = screen.getAllDisplays().map((display) => display.workArea)
  const position = positionOnScreen(prefs.mini, areas, MINI_SIZE) ?? defaultMiniPosition()
  const window = new BrowserWindow({
    ...MINI_SIZE,
    ...position,
    title: 'KeyMouse Studio 小窗',
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: options.backgroundColor(),
    webPreferences: {
      preload: options.preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
  // Stay above normal and borderless-fullscreen windows.
  window.setAlwaysOnTop(true, 'screen-saver')
  options.secureWebContents(window)
  window.on('moved', rememberMiniPosition)
  window.on('closed', () => {
    if (miniWindow === window) miniWindow = undefined
    rebuildTrayMenu()
  })
  // Do not take focus away from the game or program being automated.
  window.once('ready-to-show', () => window.showInactive())
  void options.loadRenderer(window, 'mini')
  return window
}

export function toggleMiniWindow(force) {
  const show = typeof force === 'boolean' ? force : !isMiniVisible()
  if (show) {
    if (!miniWindow || miniWindow.isDestroyed()) miniWindow = createMiniWindow()
    else miniWindow.showInactive()
  } else if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.close()
  }
  prefs.mini = { ...prefs.mini, visible: show }
  void savePrefs()
  rebuildTrayMenu()
  return show
}

/** Commands from the mini window are carried out by the main window's renderer. */
export function handleMiniCommand(command) {
  if (command === 'showMain') showMainWindow()
  else if (['pauseToggle', 'stopActive', 'emergency'].includes(command)) sendAction(command)
  else throw new Error('unknown mini window command')
}

/* --- Lifecycle --- */

export async function initDesktopShell(shellOptions) {
  options = shellOptions
  await loadPrefs()
  createTray()
  if (prefs.mini.visible) toggleMiniWindow(true)
}

export function destroyDesktopShell() {
  clearTimeout(savePositionTimer)
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.destroy()
  miniWindow = undefined
  if (tray && !tray.isDestroyed()) tray.destroy()
  tray = undefined
}
