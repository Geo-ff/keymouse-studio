import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { startSidecar, stopSidecar } from './sidecar-manager.mjs'

const directory = path.dirname(fileURLToPath(import.meta.url))
let sidecar

app.whenReady().then(async () => {
  sidecar = await startSidecar(process.env.KEYMOUSE_PYTHON ?? 'python', path.join(directory, 'sidecar.py'))
  ipcMain.handle('connection:get', () => sidecar.connection)
  const window = new BrowserWindow({
    width: 640,
    height: 360,
    webPreferences: {
      preload: path.join(directory, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
  await window.loadFile(path.join(directory, 'index.html'))
})

app.on('window-all-closed', () => app.quit())
app.on('before-quit', async (event) => {
  if (sidecar?.child.exitCode === null) {
    event.preventDefault()
    await stopSidecar(sidecar.child)
    sidecar = undefined
    app.quit()
  }
})