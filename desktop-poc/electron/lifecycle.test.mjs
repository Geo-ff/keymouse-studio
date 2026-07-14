import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { startSidecar, stopSidecar } from './sidecar-manager.mjs'

const directory = path.dirname(fileURLToPath(import.meta.url))
const python = process.env.KEYMOUSE_PYTHON ?? 'python'


test('sidecar uses dynamic port, token authentication, and exits cleanly', async () => {
  const sidecar = await startSidecar(python, path.join(directory, 'sidecar.py'))
  try {
    assert.ok(sidecar.connection.port > 0)
    assert.ok(sidecar.connection.token.length >= 32)
    const url = `http://127.0.0.1:${sidecar.connection.port}/health`
    assert.equal((await fetch(url)).status, 401)
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${sidecar.connection.token}` },
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'ok' })
  } finally {
    await stopSidecar(sidecar.child)
  }
  assert.ok(sidecar.child.exitCode !== null || sidecar.child.signalCode !== null)
})