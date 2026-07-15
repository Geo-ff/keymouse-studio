import { app, dialog } from 'electron'
import electronUpdater from 'electron-updater'
import { APP_TITLE, GITHUB_OWNER, GITHUB_REPO } from './constants.mjs'

const { autoUpdater } = electronUpdater

let initialized = false
let checking = false
let downloading = false
let updateAvailableInfo = null
let menuStatusLabel = '检查更新'
const statusListeners = new Set()

function setMenuStatus(label) {
  menuStatusLabel = label
  for (const listener of statusListeners) {
    try {
      listener(label)
    } catch {
      // ignore listener errors
    }
  }
}

export function getUpdateMenuLabel() {
  return menuStatusLabel
}

export function onUpdateMenuStatus(listener) {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

export function configureAutoUpdater() {
  if (initialized) return
  initialized = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
  })

  autoUpdater.on('checking-for-update', () => {
    checking = true
    setMenuStatus('正在检查更新…')
  })

  autoUpdater.on('update-available', (info) => {
    checking = false
    updateAvailableInfo = info
    setMenuStatus(`发现新版本 v${info.version}`)
  })

  autoUpdater.on('update-not-available', () => {
    checking = false
    updateAvailableInfo = null
    setMenuStatus('已是最新版本')
  })

  autoUpdater.on('download-progress', (progress) => {
    downloading = true
    const percent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)))
    setMenuStatus(`下载中 ${percent}%`)
  })

  autoUpdater.on('update-downloaded', (info) => {
    checking = false
    downloading = false
    updateAvailableInfo = info
    setMenuStatus(`已下载 v${info.version}，可重启安装`)
  })

  autoUpdater.on('error', (error) => {
    checking = false
    downloading = false
    const message = error instanceof Error ? error.message : String(error)
    setMenuStatus('更新检查失败')
    console.error('[auto-updater]', message)
  })
}

function isNewerVersion(remote, current) {
  const parse = (value) =>
    String(value)
      .replace(/^v/i, '')
      .split(/[.-]/)
      .map((part) => {
        const n = Number(part)
        return Number.isFinite(n) ? n : part
      })
  const a = parse(remote)
  const b = parse(current)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i += 1) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (typeof x === 'number' && typeof y === 'number') {
      if (x > y) return true
      if (x < y) return false
      continue
    }
    const xs = String(x)
    const ys = String(y)
    if (xs > ys) return true
    if (xs < ys) return false
  }
  return false
}

export async function checkForUpdates({ silent = false } = {}) {
  if (!app.isPackaged) {
    setMenuStatus('开发模式不可更新')
    if (!silent) {
      await dialog.showMessageBox({
        type: 'info',
        title: APP_TITLE,
        message: '开发模式',
        detail:
          '当前为开发构建，不会连接 GitHub Releases 执行正式更新安装。请使用已发布的安装包验证自动更新。',
      })
    }
    return { status: 'dev-mode' }
  }

  if (checking || downloading) {
    return { status: 'busy', label: menuStatusLabel }
  }

  configureAutoUpdater()
  setMenuStatus('正在检查更新…')
  checking = true

  try {
    const result = await autoUpdater.checkForUpdates()
    checking = false
    const current = app.getVersion()
    const remoteVersion = result?.updateInfo?.version

    if (!remoteVersion || !isNewerVersion(remoteVersion, current)) {
      setMenuStatus('已是最新版本')
      if (!silent) {
        await dialog.showMessageBox({
          type: 'info',
          title: APP_TITLE,
          message: '已是最新版本',
          detail: `当前版本 v${current}`,
        })
      }
      return { status: 'up-to-date', version: current }
    }

    updateAvailableInfo = result.updateInfo
    setMenuStatus(`发现新版本 v${remoteVersion}`)

    if (silent) {
      return { status: 'available', version: remoteVersion }
    }

    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: APP_TITLE,
      message: `发现新版本 v${remoteVersion}`,
      detail: `当前版本 v${current}\n是否立即下载更新？`,
      buttons: ['立即下载', '稍后'],
      defaultId: 0,
      cancelId: 1,
    })

    if (response === 0) {
      return downloadUpdate()
    }
    return { status: 'available', version: remoteVersion, deferred: true }
  } catch (error) {
    checking = false
    setMenuStatus('更新检查失败')
    const message = error instanceof Error ? error.message : String(error)
    if (!silent) {
      await dialog.showMessageBox({
        type: 'warning',
        title: APP_TITLE,
        message: '检查更新失败',
        detail: `${message}\n\n应用可继续正常使用。请检查网络或稍后重试。`,
      })
    }
    return { status: 'error', message }
  }
}

export async function downloadUpdate() {
  if (!app.isPackaged) {
    return { status: 'dev-mode' }
  }
  if (downloading) {
    return { status: 'busy', label: menuStatusLabel }
  }

  configureAutoUpdater()
  downloading = true
  setMenuStatus('开始下载…')

  try {
    await autoUpdater.downloadUpdate()
    const version = updateAvailableInfo?.version ?? '新版本'
    setMenuStatus(`已下载 v${version}，可重启安装`)

    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: APP_TITLE,
      message: '更新已下载完成',
      detail: `版本 v${version} 已就绪。是否立即重启安装？`,
      buttons: ['立即重启安装', '稍后安装'],
      defaultId: 0,
      cancelId: 1,
    })

    if (response === 0) {
      // before-quit will stop sidecar
      autoUpdater.quitAndInstall(false, true)
      return { status: 'installing', version }
    }
    return { status: 'downloaded', version, deferred: true }
  } catch (error) {
    setMenuStatus('下载失败')
    const message = error instanceof Error ? error.message : String(error)
    await dialog.showMessageBox({
      type: 'error',
      title: APP_TITLE,
      message: '下载更新失败',
      detail: message,
    })
    return { status: 'error', message }
  } finally {
    downloading = false
  }
}

export function scheduleSilentUpdateCheck(delayMs = 5000) {
  if (!app.isPackaged) return
  setTimeout(() => {
    void checkForUpdates({ silent: true })
  }, delayMs)
}
