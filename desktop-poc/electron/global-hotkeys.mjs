import { globalShortcut } from 'electron'

/** @type {Map<string, string>} actionId -> accelerator */
const registered = new Map()
const attempted = new Map()
const failures = new Map()

/**
 * Convert UI/backend hotkey (Ctrl+F9, ctrl+shift+f12) to Electron accelerator.
 * @param {string} hotkey
 * @returns {string | null}
 */
export function toAccelerator(hotkey) {
  if (!hotkey || typeof hotkey !== 'string' || !hotkey.trim()) return null
  const parts = hotkey
    .replace(/\s+/g, '')
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return null

  const mods = []
  let key = null
  for (const part of parts) {
    const lower = part.toLowerCase()
    if (lower === 'ctrl' || lower === 'control') mods.push('CommandOrControl')
    else if (lower === 'alt') mods.push('Alt')
    else if (lower === 'shift') mods.push('Shift')
    else if (lower === 'win' || lower === 'meta' || lower === 'cmd' || lower === 'super') mods.push('Super')
    else if (/^f\d{1,2}$/i.test(part)) key = part.toUpperCase()
    else if (lower === 'esc' || lower === 'escape') key = 'Escape'
    else if (lower === 'space') key = 'Space'
    else if (lower === 'enter' || lower === 'return') key = 'Enter'
    else if (lower === 'tab') key = 'Tab'
    else if (lower === 'up' || lower === 'arrowup') key = 'Up'
    else if (lower === 'down' || lower === 'arrowdown') key = 'Down'
    else if (lower === 'left' || lower === 'arrowleft') key = 'Left'
    else if (lower === 'right' || lower === 'arrowright') key = 'Right'
    else if (lower === 'page_up' || lower === 'pageup') key = 'PageUp'
    else if (lower === 'page_down' || lower === 'pagedown') key = 'PageDown'
    else if (lower === 'home') key = 'Home'
    else if (lower === 'end') key = 'End'
    else if (lower === 'delete') key = 'Delete'
    else if (lower === 'backspace') key = 'Backspace'
    else if (lower === 'insert') key = 'Insert'
    else if (part.length === 1) key = part.toUpperCase()
    else key = part
  }
  if (!key) return null
  return [...new Set(mods), key].join('+')
}

/**
 * @param {Record<string, string>} bindings actionId -> hotkey display/backend form
 * @param {(actionId: string) => void} onAction
 * @returns {{ ok: boolean, failed: Array<{ actionId: string, hotkey: string, accelerator: string }> }}
 */
export function setGlobalHotkeys(bindings, onAction) {
  const desired = new Map()
  const failed = []
  for (const [actionId, hotkeyValue] of Object.entries(bindings || {})) {
    const hotkey = String(hotkeyValue || '').trim()
    if (!hotkey) continue
    const accelerator = toAccelerator(hotkey)
    if (!accelerator) {
      desired.set(actionId, '')
      const failure = { actionId, hotkey, accelerator: '' }
      failures.set(actionId, failure)
      attempted.set(actionId, '')
      failed.push(failure)
      continue
    }
    desired.set(actionId, accelerator)
  }

  for (const [actionId, accelerator] of registered) {
    if (desired.get(actionId) === accelerator) continue
    try {
      globalShortcut.unregister(accelerator)
    } catch {
      // ignore
    }
    registered.delete(actionId)
    attempted.delete(actionId)
    failures.delete(actionId)
  }
  for (const actionId of attempted.keys()) {
    if (!desired.has(actionId)) {
      attempted.delete(actionId)
      failures.delete(actionId)
    }
  }

  for (const [actionId, accelerator] of desired) {
    if (!accelerator) continue
    if (registered.get(actionId) === accelerator) continue
    if (attempted.get(actionId) === accelerator) {
      const failure = failures.get(actionId)
      if (failure) failed.push(failure)
      continue
    }
    attempted.set(actionId, accelerator)
    const hotkey = String(bindings[actionId])
    try {
      const ok = globalShortcut.register(accelerator, () => {
        onAction(actionId)
      })
      if (!ok) {
        const failure = { actionId, hotkey, accelerator }
        failures.set(actionId, failure)
        failed.push(failure)
        continue
      }
      registered.set(actionId, accelerator)
      failures.delete(actionId)
    } catch {
      const failure = { actionId, hotkey, accelerator }
      failures.set(actionId, failure)
      failed.push(failure)
    }
  }
  return { ok: failed.length === 0, failed }
}

export function unregisterAll() {
  for (const accelerator of registered.values()) {
    try {
      globalShortcut.unregister(accelerator)
    } catch {
      // ignore
    }
  }
  registered.clear()
  attempted.clear()
  failures.clear()
}