import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { startSidecar, stopSidecar } from './sidecar-manager.mjs'

const directory = path.dirname(fileURLToPath(import.meta.url))
const productionEntry = path.resolve(directory, '../../react-vite/dist/index.html')
let sidecar
let rendererOrigin
let quitting = false

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
  ipcMain.handle('connection:get', (event) => {
    if (!isTrustedRenderer(event.senderFrame.url)) throw new Error('untrusted renderer')
    return sidecar.connection
  })

  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(directory, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRenderer(url)) event.preventDefault()
  })

  if (developmentEntry) await window.loadURL(developmentEntry.href)
  else await window.loadFile(productionEntry)
}

app.whenReady().then(async () => {
  try {
    sidecar = await startSidecar(
      process.env.KEYMOUSE_PYTHON ?? 'python',
      path.join(directory, 'backend-sidecar.py'),
    )
    await createWindow()
  } catch (error) {
    console.error(error)
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
  await stopSidecar(sidecar.child)
  sidecar = undefined
  app.quit()
})
