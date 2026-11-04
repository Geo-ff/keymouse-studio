import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeFileName } from './desktop-utils.mjs'

test('sanitizeFileName keeps a plain .json base name', () => {
  assert.equal(sanitizeFileName('签到.json'), '签到.json')
  assert.equal(sanitizeFileName('签到'), '签到.json')
  assert.equal(sanitizeFileName('../../etc/passwd'), 'passwd.json')
  assert.equal(sanitizeFileName('a:b*c?.json'), 'a_b_c_.json')
  assert.equal(sanitizeFileName(''), 'keymouse-scripts.json')
  assert.equal(sanitizeFileName(undefined), 'keymouse-scripts.json')
})

import { isSameRenderer, normalizeDesktopPrefs, positionOnScreen, trayTooltip } from './desktop-utils.mjs'

test('normalizeDesktopPrefs falls back to safe defaults', () => {
  assert.deepEqual(normalizeDesktopPrefs(null), { closeBehavior: 'ask', trayHintShown: false, mini: { visible: false } })
  assert.deepEqual(
    normalizeDesktopPrefs({ closeBehavior: 'tray', trayHintShown: true, mini: { visible: true, x: 10, y: 20 } }),
    { closeBehavior: 'tray', trayHintShown: true, mini: { visible: true, x: 10, y: 20 } },
  )
  assert.deepEqual(
    normalizeDesktopPrefs({ closeBehavior: 'explode', mini: { visible: 'yes', x: 1.5, y: 2 } }),
    { closeBehavior: 'ask', trayHintShown: false, mini: { visible: false } },
  )
})

test('trayTooltip names the status and respects the Windows limit', () => {
  assert.equal(trayTooltip(''), 'KeyMouse Studio · 空闲')
  assert.equal(trayTooltip('运行中 · 连点器'), 'KeyMouse Studio · 运行中 · 连点器')
  assert.equal(trayTooltip('x'.repeat(300)).length, 127)
})

test('isSameRenderer accepts the mini window hash but nothing else', () => {
  const origin = 'file:///C:/Program%20Files/KeyMouse/resources/renderer/index.html'
  assert.equal(isSameRenderer(origin, origin), true)
  assert.equal(isSameRenderer(`${origin}#mini`, origin), true)
  assert.equal(isSameRenderer('file:///C:/evil/index.html', origin), false)
  assert.equal(isSameRenderer(`${origin}?x=1`, origin), false)
  assert.equal(isSameRenderer('http://127.0.0.1:5173/#mini', 'http://127.0.0.1:5173'), true)
  assert.equal(isSameRenderer('http://127.0.0.1:5174/', 'http://127.0.0.1:5173'), false)
})

test('positionOnScreen drops positions on a disconnected monitor', () => {
  const areas = [{ x: 0, y: 0, width: 1920, height: 1040 }]
  const size = { width: 320, height: 132 }
  assert.deepEqual(positionOnScreen({ x: 1500, y: 20 }, areas, size), { x: 1500, y: 20 })
  assert.equal(positionOnScreen({ x: 2500, y: 20 }, areas, size), null)
  assert.equal(positionOnScreen(undefined, areas, size), null)
})
