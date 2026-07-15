import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, Notification } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { createAppMenu, getAppTitle } from './app-menu.mjs'
import { startSidecar, stopSidecar } from './sidecar-manager.mjs'

const directory = path.dirname(fileURLToPath(import.meta.url))
const productionEntry = path.resolve(directory, '../../react-vite/dist/index.html')
const taskbarIcon = path.resolve(directory, 'assets/app-icon.png')
const APP_TITLE = getAppTitle()
let sidecar
let rendererOrigin
let quitting = false
let sidecarDetach = () => {}
let mainWindow

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

function isTrustedRenderer(url) {
  if (rendererOrigin === pathToFileURL(productionEntry).href) return url === rendererOrigin
  try {
    return new URL(url).origin === rendererOrigin
  } catch {
    return false
  }
}

async function createWindow() {
  const developmentEntry = getDevelopmentEntry()
  rendererOrigin = developmentEntry?.origin ?? pathToFileURL(productionEntry).href
  ipcMain.removeHandler('connection:get')
  ipcMain.removeHandler('theme:set')
  ipcMain.removeHandler('notify:show')
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
    const title = typeof options.title === 'string' && options.title.trim() ? options.title.trim() : APP_TITLE
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
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    title: APP_TITLE,
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
  window.setTitle(APP_TITLE)
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRenderer(url)) event.preventDefault()
  })
  window.webContents.on('page-title-updated', (event) => {
    event.preventDefault()
    window.setTitle(APP_TITLE)
  })

  if (developmentEntry) await window.loadURL(developmentEntry.href)
  else await window.loadFile(productionEntry)

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
  ipcMain.removeHandler('connection:get')
  ipcMain.removeHandler('theme:set')
  ipcMain.removeHandler('notify:show')

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

app.whenReady().then(async () => {
  try {
    app.setName(APP_TITLE)
    applyNativeTheme('system')
    Menu.setApplicationMenu(createAppMenu())
    sidecar = await startSidecar(
      process.env.KEYMOUSE_PYTHON ?? 'python',
      path.join(directory, 'backend-sidecar.py'),
      {
        onCrash: (error) => {
          void handleSidecarCrash(error)
        },
      },
    )
    sidecarDetach = sidecar.detach ?? (() => {})
    await createWindow()
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
    if (sidecar) await stopSidecar(sidecar.child)
    app.quit()
  }
})

app.on('window-all-closed', () => app.quit())
app.on('before-quit', async (event) => {
  if (quitting || !sidecar || sidecar.child.exitCode !== null || sidecar.child.signalCode !== null) return
  event.preventDefault()
  quitting = true
  ipcMain.removeHandler('connection:get')
  ipcMain.removeHandler('theme:set')
  ipcMain.removeHandler('notify:show')

  sidecarDetach()
  sidecarDetach = () => {}
  await stopSidecar(sidecar.child)
  sidecar = undefined
  app.quit()
})
