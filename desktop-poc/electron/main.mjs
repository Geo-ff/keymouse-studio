import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, Notification, shell } from 'electron'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { createAppMenu, getAppTitle, setMenuUiHandlers } from './app-menu.mjs'
import {
  configureAutoUpdater,
  checkForUpdates,
  downloadUpdate,
  getUpdateState,
  quitAndInstallUpdate,
  scheduleSilentUpdateCheck,
  setUpdateStateBroadcaster,
} from './auto-updater.mjs'
import {
  APP_DESCRIPTION,
  APP_TITLE,
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_REPO_URL,
} from './constants.mjs'
import {
  createSidecarUnavailableError,
  startSidecar,
  stopSidecar,
} from './sidecar-manager.mjs'
import { setGlobalHotkeys, unregisterAll as unregisterGlobalHotkeys } from './global-hotkeys.mjs'
import { isAllowedExternalUrl, isSameRenderer, sanitizeFileName } from './desktop-utils.mjs'
import {
  destroyDesktopShell,
  getDesktopPrefs,
  handleMainWindowClose,
  handleMiniCommand,
  initDesktopShell,
  setDesktopPrefs,
  setShellStatus,
  showMainWindow,
  toggleMiniWindow,
} from './desktop-shell.mjs'

const directory = path.dirname(fileURLToPath(import.meta.url))
const productionEntry = path.resolve(directory, '../../react-vite/dist/index.html')
const packagedRendererEntry = path.join(process.resourcesPath ?? directory, 'renderer', 'index.html')
const taskbarIcon = path.resolve(directory, 'assets/app-icon.png')
const TITLE = getAppTitle()
let sidecar
let rendererOrigin
let quitting = false
let sidecarDetach = () => {}
let mainWindow
let ipcRegistered = false
let hotkeyFailureSignature = ''
/** Set as soon as a real quit starts, so closing the window is no longer turned into "hide". */
let appIsQuitting = false

// One instance only: with "close to tray" a second launch would start another engine and fight
// over the global hotkeys. A second launch brings the existing window back instead.
const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())
}

const ACTION_LABELS = {
  emergency: '急停',
  recordStart: '开始录制',
  recordStop: '停止录制',
  playbackStart: '开始回放',
  playbackStop: '停止回放',
  clickerToggle: '连点器开关',
  pauseToggle: '暂停/继续',
}

function hotkeyActionLabel(actionId) {
  if (typeof actionId === 'string' && actionId.startsWith('script:')) return '脚本快捷键'
  return ACTION_LABELS[actionId] || actionId
}

const IPC_HANDLERS = [
  'connection:get',
  'theme:set',
  'notify:show',
  'app:getVersion',
  'app:getAboutInfo',
  'shell:openExternal',
  'update:check',
  'update:getState',
  'update:download',
  'update:install',
  'hotkeys:set',
  'file:saveText',
  'mini:toggle',
  'mini:command',
  'shell:setStatus',
  'prefs:get',
  'prefs:set',
]

const MAX_SAVE_TEXT_BYTES = 50 * 1024 * 1024


function applyNativeTheme(theme) {
  if (theme === 'dark' || theme === 'light') {
    nativeTheme.themeSource = theme
  } else {
    nativeTheme.themeSource = 'system'
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1a1b1e' : '#f5f5f5')
  }
}

function getDevelopmentEntry() {
  const value = process.env.KEYMOUSE_VITE_URL
  if (!value) return undefined
  const url = new URL(value)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password) {
    throw new Error('KEYMOUSE_VITE_URL must be a trusted http://127.0.0.1 URL')
  }
  return url
}

function resolveRendererEntry() {
  if (app.isPackaged && existsSync(packagedRendererEntry)) {
    return packagedRendererEntry
  }
  return productionEntry
}

function isTrustedRenderer(url) {
  return isSameRenderer(url, rendererOrigin)
}

function secureWebContents(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRenderer(url)) event.preventDefault()
  })
}

/** Load the renderer; `view` selects a secondary view such as the mini window ("mini"). */
async function loadRenderer(window, view) {
  const developmentEntry = getDevelopmentEntry()
  if (developmentEntry) {
    const url = new URL(developmentEntry.href)
    if (view) url.hash = view
    await window.loadURL(url.href)
  } else {
    await window.loadFile(resolveRendererEntry(), view ? { hash: view } : undefined)
  }
}

function assertTrusted(event) {
  if (!isTrustedRenderer(event.senderFrame.url)) throw new Error('untrusted renderer')
}

function sendToRenderer(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(channel, payload)
}

function resolveSidecarLaunch() {
  if (app.isPackaged) {
    const sidecarExe = path.join(process.resourcesPath, 'sidecar', 'keymouse-sidecar.exe')
    if (!existsSync(sidecarExe)) {
      throw createSidecarUnavailableError(sidecarExe)
    }
    return { command: sidecarExe, args: [] }
  }

  const python = process.env.KEYMOUSE_PYTHON ?? 'python'
  const script = path.join(directory, 'backend-sidecar.py')
  return {
    command: python,
    args: ['-u', script],
    env: {
      PYTHONPATH: [path.resolve(directory, '../../backend/src'), process.env.PYTHONPATH]
        .filter(Boolean)
        .join(path.delimiter),
    },
  }
}

function registerIpcHandlers() {
  if (ipcRegistered) {
    for (const channel of IPC_HANDLERS) ipcMain.removeHandler(channel)
  }
  ipcRegistered = true

  ipcMain.handle('connection:get', (event) => {
    assertTrusted(event)
    return sidecar.connection
  })
  ipcMain.handle('theme:set', (event, theme) => {
    assertTrusted(event)
    applyNativeTheme(theme === 'dark' || theme === 'light' ? theme : 'system')
    return { ok: true, dark: nativeTheme.shouldUseDarkColors }
  })
  ipcMain.handle('notify:show', async (event, options = {}) => {
    assertTrusted(event)
    const title = typeof options.title === 'string' && options.title.trim() ? options.title.trim() : TITLE
    const bodyParts = []
    if (typeof options.message === 'string' && options.message.trim()) bodyParts.push(options.message.trim())
    if (typeof options.detail === 'string' && options.detail.trim()) bodyParts.push(options.detail.trim())
    const body = bodyParts.join('\n')
    if (!body) throw new Error('message is required')
    if (!Notification.isSupported()) return { ok: false, reason: 'unsupported' }
    const notification = new Notification({
      title,
      body,
      icon: taskbarIcon,
      silent: false,
      timeoutType: 'default',
    })
    notification.show()
    return { ok: true }
  })
  ipcMain.handle('app:getVersion', (event) => {
    assertTrusted(event)
    return app.getVersion()
  })
  ipcMain.handle('app:getAboutInfo', (event) => {
    assertTrusted(event)
    const update = getUpdateState()
    return {
      appTitle: APP_TITLE,
      description: APP_DESCRIPTION,
      version: app.getVersion(),
      githubUrl: GITHUB_REPO_URL,
      githubOwner: GITHUB_OWNER,
      githubRepo: GITHUB_REPO,
      isPackaged: app.isPackaged,
      releaseDate: update.releaseDate,
      update,
    }
  })
  ipcMain.handle('file:saveText', async (event, options = {}) => {
    assertTrusted(event)
    const content = typeof options.content === 'string' ? options.content : ''
    if (!content || Buffer.byteLength(content, 'utf8') > MAX_SAVE_TEXT_BYTES) throw new Error('invalid content')
    const defaultPath = path.join(app.getPath('documents'), sanitizeFileName(options.defaultName))
    const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined
    const result = await dialog.showSaveDialog(parent, {
      title: '导出脚本',
      defaultPath,
      filters: [{ name: 'KeyMouse Studio 脚本', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return { ok: false, canceled: true }
    await writeFile(result.filePath, content, 'utf8')
    return { ok: true, path: result.filePath }
  })
  ipcMain.handle('mini:toggle', (event, force) => {
    assertTrusted(event)
    return { visible: toggleMiniWindow(typeof force === 'boolean' ? force : undefined) }
  })
  ipcMain.handle('mini:command', (event, command) => {
    assertTrusted(event)
    handleMiniCommand(command)
    return { ok: true }
  })
  ipcMain.handle('shell:setStatus', (event, text) => {
    assertTrusted(event)
    setShellStatus(typeof text === 'string' ? text : '')
    return { ok: true }
  })
  ipcMain.handle('prefs:get', (event) => {
    assertTrusted(event)
    return getDesktopPrefs()
  })
  ipcMain.handle('prefs:set', (event, update = {}) => {
    assertTrusted(event)
    return setDesktopPrefs({
      closeBehavior: update?.closeBehavior,
      // The renderer may only mark the running version as seen.
      lastRunVersion: update?.lastRunVersion === app.getVersion() ? update.lastRunVersion : undefined,
    })
  })
  ipcMain.handle('shell:openExternal', async (event, url) => {
    assertTrusted(event)
    if (!isAllowedExternalUrl(url, GITHUB_REPO_URL)) {
      throw new Error('blocked external url')
    }
    await shell.openExternal(url)
    return { ok: true }
  })
  ipcMain.handle('update:check', async (event) => {
    assertTrusted(event)
    return checkForUpdates({ silent: false })
  })
  ipcMain.handle('update:getState', (event) => {
    assertTrusted(event)
    return getUpdateState()
  })
  ipcMain.handle('update:download', async (event) => {
    assertTrusted(event)
    return downloadUpdate()
  })
  ipcMain.handle('update:install', (event) => {
    assertTrusted(event)
    return quitAndInstallUpdate()
  })
  ipcMain.handle('hotkeys:set', (event, bindings = {}) => {
    assertTrusted(event)
    const result = setGlobalHotkeys(bindings, (actionId) => {
      sendToRenderer('hotkeys:action', { actionId })
    })
    const failureSignature = result.failed
      .map((item) => `${item.actionId}:${item.accelerator || item.hotkey}`)
      .sort()
      .join('|')
    if (result.ok) hotkeyFailureSignature = ''
    if (
      failureSignature &&
      failureSignature !== hotkeyFailureSignature &&
      mainWindow &&
      !mainWindow.isDestroyed()
    ) {
      hotkeyFailureSignature = failureSignature
      const lines = result.failed.map((item) => {
        const label = hotkeyActionLabel(item.actionId)
        return `${label}: ${item.hotkey || item.accelerator || '未知'}`
      })
      void dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: '全局快捷键注册失败',
        message: '以下快捷键无法注册为全局快捷键, 可能与其它程序冲突',
        detail: lines.join('\n'),
        buttons: ['知道了'],
        defaultId: 0,
      })
    }
    return result
  })
}

function removeIpcHandlers() {
  if (!ipcRegistered) return
  for (const channel of IPC_HANDLERS) ipcMain.removeHandler(channel)
  ipcRegistered = false
}

async function createWindow() {
  const developmentEntry = getDevelopmentEntry()
  const rendererEntry = resolveRendererEntry()
  rendererOrigin = developmentEntry?.origin ?? pathToFileURL(rendererEntry).href
  registerIpcHandlers()

  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    title: TITLE,
    icon: taskbarIcon,
    autoHideMenuBar: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1b1e' : '#f5f5f5',
    show: false,
    webPreferences: {
      preload: path.join(directory, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
  mainWindow = window
  window.setTitle(TITLE)
  secureWebContents(window)
  window.on('close', (event) => {
    if (!appIsQuitting) void handleMainWindowClose(event, window)
  })
  window.webContents.on('page-title-updated', (event) => {
    event.preventDefault()
    window.setTitle(TITLE)
  })

  await loadRenderer(window)

  const bridgeReady = await window.webContents.executeJavaScript(
    'typeof window.desktop?.getConnectionInfo === "function"',
  )
  if (!bridgeReady) throw new Error('desktop preload bridge unavailable')
  window.show()
}

async function handleSidecarCrash(error) {
  if (quitting) return
  console.error(error)
  try {
    await dialog.showErrorBox(
      '自动化引擎已退出',
      `${error instanceof Error ? error.message : String(error)}\n\n应用将关闭。请重新启动；真实模式不会回退到 Mock。`,
    )
  } catch {
    // dialog may fail during shutdown
  }
  quitting = true
  removeIpcHandlers()

  sidecarDetach()
  sidecarDetach = () => {}
  if (sidecar) {
    try {
      await stopSidecar(sidecar.child)
    } catch (stopError) {
      console.error(stopError)
    }
    sidecar = undefined
  }
  app.quit()
}

async function shutdownSidecar() {
  sidecarDetach()
  sidecarDetach = () => {}
  if (sidecar) {
    try {
      await stopSidecar(sidecar.child)
    } catch (error) {
      console.error(error)
    }
    sidecar = undefined
  }
}

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return
  try {
    app.setName(APP_TITLE)
    applyNativeTheme('system')
    configureAutoUpdater()
    setUpdateStateBroadcaster((state) => sendToRenderer('update:state', state))
    setMenuUiHandlers({
      onOpenAbout: () => sendToRenderer('ui:open-about', {}),

    })
    Menu.setApplicationMenu(createAppMenu())

    const launch = resolveSidecarLaunch()
    sidecar = await startSidecar(launch, {
      onCrash: (error) => {
        void handleSidecarCrash(error)
      },
    })
    sidecarDetach = sidecar.detach ?? (() => {})
    await createWindow()
    await initDesktopShell({
      icon: taskbarIcon,
      preload: path.join(directory, 'preload.cjs'),
      getMainWindow: () => mainWindow,
      sendToMain: sendToRenderer,
      loadRenderer,
      secureWebContents,
      backgroundColor: () => (nativeTheme.shouldUseDarkColors ? '#1a1b1e' : '#f5f5f5'),
    })
    scheduleSilentUpdateCheck(5000)
  } catch (error) {
    console.error(error)
    try {
      await dialog.showErrorBox(
        '无法启动自动化引擎',
        error instanceof Error ? error.message : String(error),
      )
    } catch {
      // ignore
    }
    await shutdownSidecar()
    app.quit()
  }
})

app.on('window-all-closed', () => app.quit())
app.on('will-quit', () => {
  unregisterGlobalHotkeys()
  destroyDesktopShell()
})
app.on('before-quit', async (event) => {
  appIsQuitting = true
  unregisterGlobalHotkeys()
  if (quitting || !sidecar || (sidecar.child.exitCode !== null || sidecar.child.signalCode !== null)) {
    return
  }
  event.preventDefault()
  quitting = true
  removeIpcHandlers()
  await shutdownSidecar()
  app.quit()
})
