import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, Notification } from 'electron'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { createAppMenu, getAppTitle } from './app-menu.mjs'
import {
  configureAutoUpdater,
  checkForUpdates,
  scheduleSilentUpdateCheck,
} from './auto-updater.mjs'
import { APP_TITLE } from './constants.mjs'
import { startSidecar, stopSidecar } from './sidecar-manager.mjs'

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
  if (!rendererOrigin) return false
  if (rendererOrigin.startsWith('file:')) return url === rendererOrigin
  try {
    return new URL(url).origin === rendererOrigin
  } catch {
    return false
  }
}

function resolveSidecarLaunch() {
  if (app.isPackaged) {
    const sidecarExe = path.join(process.resourcesPath, 'sidecar', 'keymouse-sidecar.exe')
    if (!existsSync(sidecarExe)) {
      throw new Error(`打包资源中缺少 sidecar：${sidecarExe}`)
    }
    return { command: sidecarExe, args: [] }
  }

  const python = process.env.KEYMOUSE_PYTHON ?? 'python'
  const script = path.join(directory, 'backend-sidecar.py')
  return { command: python, args: ['-u', script], env: {
    PYTHONPATH: [path.resolve(directory, '../../backend/src'), process.env.PYTHONPATH]
      .filter(Boolean)
      .join(path.delimiter),
  } }
}

function registerIpcHandlers() {
  if (ipcRegistered) {
    ipcMain.removeHandler('connection:get')
    ipcMain.removeHandler('theme:set')
    ipcMain.removeHandler('notify:show')
    ipcMain.removeHandler('app:getVersion')
    ipcMain.removeHandler('update:check')
  }
  ipcRegistered = true

  ipcMain.handle('connection:get', (event) => {
    if (!isTrustedRenderer(event.senderFrame.url)) throw new Error('untrusted renderer')
    return sidecar.connection
  })
  ipcMain.handle('theme:set', (event, theme) => {
    if (!isTrustedRenderer(event.senderFrame.url)) throw new Error('untrusted renderer')
    applyNativeTheme(theme === 'dark' || theme === 'light' ? theme : 'system')
    return { ok: true, dark: nativeTheme.shouldUseDarkColors }
  })
  ipcMain.handle('notify:show', async (event, options = {}) => {
    if (!isTrustedRenderer(event.senderFrame.url)) throw new Error('untrusted renderer')
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
    if (!isTrustedRenderer(event.senderFrame.url)) throw new Error('untrusted renderer')
    return app.getVersion()
  })
  ipcMain.handle('update:check', async (event) => {
    if (!isTrustedRenderer(event.senderFrame.url)) throw new Error('untrusted renderer')
    return checkForUpdates({ silent: false })
  })
}

function removeIpcHandlers() {
  if (!ipcRegistered) return
  ipcMain.removeHandler('connection:get')
  ipcMain.removeHandler('theme:set')
  ipcMain.removeHandler('notify:show')
  ipcMain.removeHandler('app:getVersion')
  ipcMain.removeHandler('update:check')
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
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRenderer(url)) event.preventDefault()
  })
  window.webContents.on('page-title-updated', (event) => {
    event.preventDefault()
    window.setTitle(TITLE)
  })

  if (developmentEntry) await window.loadURL(developmentEntry.href)
  else await window.loadFile(rendererEntry)

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
  try {
    app.setName(APP_TITLE)
    applyNativeTheme('system')
    configureAutoUpdater()
    Menu.setApplicationMenu(createAppMenu())

    const launch = resolveSidecarLaunch()
    sidecar = await startSidecar(launch, {
      onCrash: (error) => {
        void handleSidecarCrash(error)
      },
    })
    sidecarDetach = sidecar.detach ?? (() => {})
    await createWindow()
    scheduleSilentUpdateCheck(8000)
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
app.on('before-quit', async (event) => {
  if (quitting || !sidecar || (sidecar.child.exitCode !== null || sidecar.child.signalCode !== null)) {
    return
  }
  event.preventDefault()
  quitting = true
  removeIpcHandlers()
  await shutdownSidecar()
  app.quit()
})
