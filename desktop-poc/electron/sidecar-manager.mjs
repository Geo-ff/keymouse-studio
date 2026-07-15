import { spawn } from 'node:child_process'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const directory = path.dirname(fileURLToPath(import.meta.url))
const backendSource = path.resolve(directory, '../../backend/src')
const HANDSHAKE_TIMEOUT_MS = 15000
const STOP_TIMEOUT_MS = 2000
const FORCE_STOP_TIMEOUT_MS = 2000

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true)
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timer)
      resolve(true)
    }
    const timer = setTimeout(() => {
      child.off('exit', onExit)
      resolve(false)
    }, timeoutMs)
    child.once('exit', onExit)
  })
}

function validateConnection(connection) {
  if (
    connection === null ||
    typeof connection !== 'object' ||
    !Number.isInteger(connection.port) ||
    connection.port < 1 ||
    connection.port > 65535 ||
    typeof connection.token !== 'string' ||
    connection.token.length < 32 ||
    (connection.host !== undefined && connection.host !== '127.0.0.1')
  ) {
    throw new Error('invalid sidecar handshake')
  }
  return { host: '127.0.0.1', port: connection.port, token: connection.token }
}

export function attachSidecarWatchers(child, { onCrash, onStderr } = {}) {
  const stderrHandler = (chunk) => {
    const text = String(chunk)
    process.stderr.write(`[sidecar] ${text}`)
    onStderr?.(text)
  }
  child.stderr.on('data', stderrHandler)
  const onExit = (code, signal) => {
    if (code === 0 || signal === 'SIGTERM' || signal === 'SIGKILL') return
    const reason = `sidecar exited unexpectedly: code=${code ?? 'null'} signal=${signal ?? 'null'}`
    process.stderr.write(`[sidecar] ${reason}\n`)
    onCrash?.(new Error(reason))
  }
  child.on('exit', onExit)
  return () => {
    child.stderr.off('data', stderrHandler)
    child.off('exit', onExit)
  }
}

/**
 * @param {string | { command: string, args?: string[], env?: Record<string, string>, cwd?: string }} launch
 * @param {string} [script] legacy python script path when launch is python executable
 * @param {object} [options]
 */
export async function startSidecar(launch, script, options = {}) {
  let command
  let args
  let env = { ...process.env }
  let cwd

  if (typeof launch === 'object' && launch !== null && launch.command) {
    command = launch.command
    args = launch.args ?? []
    env = { ...env, ...(launch.env ?? {}) }
    cwd = launch.cwd
    options = script && typeof script === 'object' ? script : options
  } else {
    const python = launch
    const pythonPath = [backendSource, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter)
    command = python
    args = ['-u', script]
    env = { ...env, PYTHONPATH: pythonPath }
  }

  const child = spawn(command, args, {
    env,
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  child.stdin.on('error', () => {})
  const preHandshakeStderr = (chunk) => process.stderr.write(`[sidecar] ${chunk}`)
  child.stderr.on('data', preHandshakeStderr)
  const lines = createInterface({ input: child.stdout })

  try {
    const connection = await new Promise((resolve, reject) => {
      let settled = false
      const finish = (callback, value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        child.off('error', onError)
        child.off('exit', onExit)
        lines.off('line', onLine)
        callback(value)
      }
      const onError = (error) => finish(reject, error)
      const onExit = (code, signal) => {
        finish(reject, new Error(`sidecar exited before handshake: ${code ?? signal}`))
      }
      const onLine = (line) => {
        try {
          finish(resolve, validateConnection(JSON.parse(line)))
        } catch (error) {
          finish(reject, error)
        }
      }
      const timer = setTimeout(
        () => finish(reject, new Error('sidecar handshake timeout')),
        HANDSHAKE_TIMEOUT_MS,
      )
      child.once('error', onError)
      child.once('exit', onExit)
      lines.once('line', onLine)
    })
    lines.close()
    child.stdout.resume()
    child.stderr.off('data', preHandshakeStderr)
    const detach = attachSidecarWatchers(child, options)
    return { child, connection, detach }
  } catch (error) {
    lines.close()
    child.stdout.resume()
    child.stderr.off('data', preHandshakeStderr)
    await stopSidecar(child)
    throw error
  }
}

export async function stopSidecar(child) {
  if (child.exitCode !== null || child.signalCode !== null) return

  const gracefulExit = waitForExit(child, STOP_TIMEOUT_MS)
  if (child.stdin?.writable) child.stdin.end('shutdown\n')
  else child.kill()
  if (await gracefulExit) return

  const forcedExit = waitForExit(child, FORCE_STOP_TIMEOUT_MS)
  child.kill('SIGKILL')
  if (!(await forcedExit)) throw new Error('sidecar did not exit after forced termination')
}
