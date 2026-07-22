import { app } from 'electron'
import electronUpdater from 'electron-updater'
import { APP_TITLE, GITHUB_OWNER, GITHUB_REPO } from './constants.mjs'

const { autoUpdater } = electronUpdater

let initialized = false
let checking = false
let downloading = false
let updateAvailableInfo = null
let menuStatusLabel = '检查更新'
const statusListeners = new Set()
let stateBroadcaster = null

/** @type {import('./auto-updater-types').UpdateState} */
let updateState = {
  status: 'idle',
  currentVersion: '',
  version: null,
  percent: 0,
  transferred: 0,
  total: 0,
  message: '',
  releaseDate: null,
  releaseNotes: null,
  label: '检查更新',
}

function currentVersion() {
  try {
    return app.getVersion()
  } catch {
    return '0.0.0'
  }
}

function setMenuStatus(label) {
  menuStatusLabel = label
  updateState = { ...updateState, label }
  for (const listener of statusListeners) {
    try {
      listener(label)
    } catch {
      // ignore
    }
  }
}

function emitState(patch = {}) {
  updateState = {
    ...updateState,
    currentVersion: currentVersion(),
    ...patch,
    label: patch.label ?? menuStatusLabel,
  }
  try {
    stateBroadcaster?.(getUpdateState())
  } catch {
    // ignore
  }
}

export function setUpdateStateBroadcaster(fn) {
  stateBroadcaster = typeof fn === 'function' ? fn : null
}

export function getUpdateState() {
  return {
    ...updateState,
    currentVersion: currentVersion(),
    checking,
    downloading,
  }
}

export function getUpdateMenuLabel() {
  return menuStatusLabel
}

export function onUpdateMenuStatus(listener) {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

function releaseDateFromInfo(info) {
  if (!info) return null
  const raw = info.releaseDate || info.pub_date || info.publishedAt
  if (!raw) return null
  try {
    return new Date(raw).toISOString()
  } catch {
    return String(raw)
  }
}

/**
 * electron-updater may return releaseNotes as string, ReleaseNoteInfo[], or null.
 * @param {unknown} notes
 * @returns {string | null}
 */
export function normalizeReleaseNotes(notes) {
  if (notes == null) return null
  if (typeof notes === 'string') {
    const trimmed = notes.trim()
    return trimmed || null
  }
  if (Array.isArray(notes)) {
    const parts = notes
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') {
          const note = 'note' in item ? item.note : null
          const version = 'version' in item ? item.version : null
          const body = typeof note === 'string' ? note.trim() : ''
          if (!body) return ''
          return version ? `## ${version}\n${body}` : body
        }
        return ''
      })
      .filter(Boolean)
    return parts.length ? parts.join('\n\n') : null
  }
  if (typeof notes === 'object' && notes !== null && 'note' in notes) {
    const body = typeof notes.note === 'string' ? notes.note.trim() : ''
    return body || null
  }
  const asString = String(notes).trim()
  return asString || null
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
    emitState({ status: 'checking', message: '正在检查更新…', percent: 0 })
  })

  autoUpdater.on('update-available', (info) => {
    checking = false
    updateAvailableInfo = info
    setMenuStatus(`发现新版本 v${info.version}`)
    emitState({
      status: 'available',
      version: info.version,
      releaseDate: releaseDateFromInfo(info),
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      message: `发现新版本 v${info.version}`,
      percent: 0,
    })
  })

  autoUpdater.on('update-not-available', () => {
    checking = false
    updateAvailableInfo = null
    setMenuStatus('已是最新版本')
    emitState({
      status: 'up-to-date',
      version: null,
      message: '已是最新版本',
      percent: 0,
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    downloading = true
    const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0))
    const rounded = Math.round(percent)
    setMenuStatus(`下载中 ${rounded}%`)
    emitState({
      status: 'downloading',
      percent,
      transferred: Number(progress.transferred) || 0,
      total: Number(progress.total) || 0,
      message: `正在下载更新 ${rounded}%`,
      version: updateAvailableInfo?.version ?? updateState.version,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    checking = false
    downloading = false
    updateAvailableInfo = info
    setMenuStatus(`已下载 v${info.version}，可重启安装`)
    emitState({
      status: 'downloaded',
      version: info.version,
      percent: 100,
      releaseDate: releaseDateFromInfo(info),
      releaseNotes:
        normalizeReleaseNotes(info.releaseNotes) ??
        updateState.releaseNotes ??
        null,
      message: `更新 v${info.version} 已下载完成`,
    })
  })

  autoUpdater.on('error', (error) => {
    checking = false
    downloading = false
    const message = error instanceof Error ? error.message : String(error)
    setMenuStatus('更新检查失败')
    emitState({ status: 'error', message, percent: updateState.percent })
    console.error('[auto-updater]', message)
  })
}

/**
 * @param {{ silent?: boolean }} [options]
 */
export async function checkForUpdates({ silent = false } = {}) {
  if (!app.isPackaged) {
    setMenuStatus('开发模式不可更新')
    emitState({
      status: 'dev-mode',
      message: '开发模式不会连接 GitHub Releases 执行正式更新',
      percent: 0,
    })
    return { status: 'dev-mode', ...getUpdateState() }
  }

  if (checking || downloading) {
    return { status: 'busy', ...getUpdateState() }
  }

  configureAutoUpdater()
  setMenuStatus('正在检查更新…')
  checking = true
  emitState({ status: 'checking', message: '正在检查更新…', percent: 0 })

  try {
    const result = await autoUpdater.checkForUpdates()
    checking = false
    const current = currentVersion()
    const remoteVersion = result?.updateInfo?.version

    if (!remoteVersion || !isNewerVersion(remoteVersion, current)) {
      setMenuStatus('已是最新版本')
      emitState({
        status: 'up-to-date',
        version: null,
        message: silent ? '已是最新版本' : `当前版本 v${current} 已是最新`,
        percent: 0,
      })
      return { status: 'up-to-date', version: current, silent }
    }

    updateAvailableInfo = result.updateInfo
    const releaseNotes = normalizeReleaseNotes(result.updateInfo?.releaseNotes)
    setMenuStatus(`发现新版本 v${remoteVersion}`)
    emitState({
      status: 'available',
      version: remoteVersion,
      releaseDate: releaseDateFromInfo(result.updateInfo),
      releaseNotes,
      message: `发现新版本 v${remoteVersion}`,
      percent: 0,
    })
    return {
      status: 'available',
      version: remoteVersion,
      silent,
      releaseDate: releaseDateFromInfo(result.updateInfo),
      releaseNotes,
    }
  } catch (error) {
    checking = false
    const message = error instanceof Error ? error.message : String(error)
    setMenuStatus('更新检查失败')
    emitState({
      status: 'error',
      message: silent ? message : `检查更新失败：${message}`,
    })
    return { status: 'error', message, silent }
  }
}

export async function downloadUpdate() {
  if (!app.isPackaged) {
    emitState({ status: 'dev-mode', message: '开发模式不可下载更新' })
    return { status: 'dev-mode' }
  }
  if (downloading) {
    return { status: 'busy', ...getUpdateState() }
  }

  configureAutoUpdater()
  downloading = true
  setMenuStatus('开始下载…')
  emitState({
    status: 'downloading',
    percent: 0,
    message: '开始下载更新…',
    version: updateAvailableInfo?.version ?? updateState.version,
  })

  try {
    await autoUpdater.downloadUpdate()
    const version = updateAvailableInfo?.version ?? updateState.version ?? '新版本'
    setMenuStatus(`已下载 v${version}，可重启安装`)
    emitState({
      status: 'downloaded',
      version,
      percent: 100,
      message: `更新 v${version} 已下载完成`,
    })
    return { status: 'downloaded', version }
  } catch (error) {
    downloading = false
    const message = error instanceof Error ? error.message : String(error)
    setMenuStatus('下载失败')
    emitState({ status: 'error', message: `下载更新失败：${message}` })
    return { status: 'error', message }
  } finally {
    downloading = false
  }
}

export function quitAndInstallUpdate() {
  if (!app.isPackaged) {
    return { status: 'dev-mode' }
  }
  configureAutoUpdater()
  emitState({ status: 'installing', message: '正在重启安装更新…', percent: 100 })
  // before-quit stops sidecar
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true)
  })
  return { status: 'installing' }
}

export function scheduleSilentUpdateCheck(delayMs = 5000) {
  if (!app.isPackaged) {
    emitState({
      status: 'dev-mode',
      message: '开发模式：自动更新已禁用',
      currentVersion: currentVersion(),
    })
    return
  }
  setTimeout(() => {
    void checkForUpdates({ silent: true })
  }, delayMs)
}

export function getAboutReleaseMeta() {
  return {
    appTitle: APP_TITLE,
    version: currentVersion(),
    releaseDate: updateAvailableInfo
      ? releaseDateFromInfo(updateAvailableInfo)
      : updateState.releaseDate,
  }
}
