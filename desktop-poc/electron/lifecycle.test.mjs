import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  createSidecarUnavailableError,
  normalizeSidecarStartError,
  startSidecar,
  stopSidecar,
} from './sidecar-manager.mjs'

const directory = path.dirname(fileURLToPath(import.meta.url))
const python = process.env.KEYMOUSE_PYTHON ?? 'python'
const token = 'x'.repeat(32)

async function withFixture(source, callback) {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'keymouse-sidecar-'))
  const script = path.join(temporaryDirectory, 'fixture.py')
  await writeFile(script, source)
  try {
    await callback(script, temporaryDirectory)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

async function waitForFile(file) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      return await readFile(file, 'utf8')
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }
  throw new Error(`timed out waiting for ${file}`)
}

test('missing sidecar explains possible security software quarantine', () => {
  const sidecarPath = String.raw`C:\Program Files\KeyMouse Studio\resources\sidecar\keymouse-sidecar.exe`
  const error = createSidecarUnavailableError(sidecarPath)
  assert.match(error.message, /可能已被 Windows 安全中心或其他安全软件隔离/)
  assert.match(error.message, /保护历史记录/)
  assert.match(error.message, /keymouse-sidecar\.exe/)
  assert.match(error.message, /C:\\Program Files\\KeyMouse Studio/)
})

test('spawn UNKNOWN is normalized to actionable quarantine guidance', () => {
  const cause = Object.assign(new Error('spawn UNKNOWN'), { code: 'UNKNOWN' })
  const error = normalizeSidecarStartError(cause, 'keymouse-sidecar.exe')
  assert.notEqual(error, cause)
  assert.equal(error.cause, cause)
  assert.match(error.message, /保护历史记录/)
  assert.match(error.message, /系统错误：spawn UNKNOWN/)
})

test('unrelated sidecar errors remain unchanged', () => {
  const cause = new Error('sidecar handshake timeout')
  assert.equal(normalizeSidecarStartError(cause, 'keymouse-sidecar.exe'), cause)
})

test('sidecar uses dynamic port, token authentication, and exits cleanly', async () => {
  const sidecar = await startSidecar(python, path.join(directory, 'sidecar.py'))
  try {
    assert.ok(sidecar.connection.port > 0)
    assert.equal(sidecar.connection.host, '127.0.0.1')
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

test('invalid JSON handshake rejects and cleans up the child', async () => {
  await withFixture(
    "import pathlib, sys\nprint('not-json', flush=True)\nsys.stdin.readline()\npathlib.Path(sys.argv[0] + '.stopped').write_text('stopped')\n",
    async (script) => {
      await assert.rejects(startSidecar(python, script), SyntaxError)
      assert.equal(await waitForFile(`${script}.stopped`), 'stopped')
    },
  )
})

test('invalid handshake fields reject and clean up the child', async () => {
  await withFixture(
    `import json, pathlib, sys\nprint(json.dumps({'host': '0.0.0.0', 'port': 0, 'token': '${token}'}), flush=True)\nsys.stdin.readline()\npathlib.Path(sys.argv[0] + '.stopped').write_text('stopped')\n`,
    async (script) => {
      await assert.rejects(startSidecar(python, script), /invalid sidecar handshake/)
      assert.equal(await waitForFile(`${script}.stopped`), 'stopped')
    },
  )
})

test('crash before handshake rejects without hanging', async () => {
  await withFixture("raise RuntimeError('fixture crash')\n", async (script) => {
    await assert.rejects(startSidecar(python, script), /sidecar exited before handshake/)
  })
})

test('handshake timeout cleans up the child', async () => {
  await withFixture(
    "import pathlib, sys\nsys.stdin.readline()\npathlib.Path(sys.argv[0] + '.stopped').write_text('stopped')\n",
    async (script) => {
      await assert.rejects(startSidecar(python, script), /sidecar handshake timeout/)
      assert.equal(await waitForFile(`${script}.stopped`), 'stopped')
    },
  )
})

test('stopSidecar force terminates a child that ignores shutdown', async () => {
  await withFixture(
    `import json, time\nprint(json.dumps({'port': 12345, 'token': '${token}'}), flush=True)\nwhile True: time.sleep(1)\n`,
    async (script) => {
      const sidecar = await startSidecar(python, script)
      await stopSidecar(sidecar.child)
      assert.ok(sidecar.child.exitCode !== null || sidecar.child.signalCode !== null)
      await stopSidecar(sidecar.child)
    },
  )
})

test('attachSidecarWatchers reports unexpected non-zero exit', async () => {
  const { attachSidecarWatchers } = await import('./sidecar-manager.mjs')
  await withFixture(
    `import json, sys\nprint(json.dumps({'port': 12345, 'token': '${token}'}), flush=True)\nsys.exit(7)\n`,
    async (script) => {
      const sidecar = await startSidecar(python, script)
      const crashes = []
      const detach = attachSidecarWatchers(sidecar.child, {
        onCrash: (error) => crashes.push(error),
      })
      await new Promise((resolve) => sidecar.child.once('exit', resolve))
      assert.equal(sidecar.child.exitCode, 7)
      assert.equal(crashes.length, 1)
      assert.match(String(crashes[0].message), /exited unexpectedly/)
      detach()
    },
  )
})
