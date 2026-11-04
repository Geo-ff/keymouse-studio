import path from 'node:path'

// Pure helpers for the main process (kept free of Electron imports so they can be unit tested).

/** Keep a suggested file name to a plain base name (no folders, no reserved characters). */
export function sanitizeFileName(name, fallback = 'keymouse-scripts.json') {
  const base = typeof name === 'string' ? path.basename(name) : ''
  const cleaned = base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 120)
  if (!cleaned || cleaned === '.' || cleaned === '..') return fallback
  return cleaned.toLowerCase().endsWith('.json') ? cleaned : `${cleaned}.json`
}

export const CLOSE_BEHAVIORS = ['ask', 'tray', 'quit']

export const DEFAULT_DESKTOP_PREFS = Object.freeze({
  closeBehavior: 'ask',
  trayHintShown: false,
  mini: Object.freeze({ visible: false }),
})

/** Validate the saved desktop preferences file; anything unexpected falls back to defaults. */
export function normalizeDesktopPrefs(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const mini = source.mini && typeof source.mini === 'object' ? source.mini : {}
  const result = {
    closeBehavior: CLOSE_BEHAVIORS.includes(source.closeBehavior) ? source.closeBehavior : 'ask',
    trayHintShown: source.trayHintShown === true,
    mini: { visible: mini.visible === true },
  }
  if (Number.isInteger(mini.x) && Number.isInteger(mini.y)) {
    result.mini.x = mini.x
    result.mini.y = mini.y
  }
  return result
}

/** Tray tooltip; Windows truncates tooltips at 127 characters. */
export function trayTooltip(statusText) {
  const status = typeof statusText === 'string' && statusText.trim() ? statusText.trim() : '空闲'
  const text = `KeyMouse Studio · ${status}`
  return text.length > 127 ? `${text.slice(0, 126)}…` : text
}

/**
 * Whether `url` belongs to the app's own renderer. File renderers compare the whole file URL,
 * ignoring only the hash (the mini window loads `index.html#mini`).
 */
export function isSameRenderer(url, rendererOrigin) {
  if (!rendererOrigin || typeof url !== 'string') return false
  if (rendererOrigin.startsWith('file:')) return url.split('#')[0] === rendererOrigin
  try {
    return new URL(url).origin === rendererOrigin
  } catch {
    return false
  }
}

/** Keep a saved window position only if it is still on a connected display. */
export function positionOnScreen(position, workAreas, size) {
  if (!position || !Number.isInteger(position.x) || !Number.isInteger(position.y)) return null
  const visible = workAreas.some((area) =>
    position.x >= area.x - size.width / 2 &&
    position.y >= area.y &&
    position.x + size.width / 2 <= area.x + area.width &&
    position.y + 24 <= area.y + area.height,
  )
  return visible ? { x: position.x, y: position.y } : null
}
