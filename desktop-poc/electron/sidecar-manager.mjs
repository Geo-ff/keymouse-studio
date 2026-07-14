import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

export async function startSidecar(python, script) {
  const child = spawn(python, [script], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  const lines = createInterface({ input: child.stdout })
  const connection = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('sidecar handshake timeout')), 5000)
    child.once('error', reject)
    child.once('exit', (code) => reject(new Error(`sidecar exited before handshake: ${code}`)))
    lines.once('line', (line) => {
      clearTimeout(timer)
      try {
        resolve(JSON.parse(line))
      } catch (error) {
        reject(error)
      }
    })
  })
  if (!Number.isInteger(connection.port) || typeof connection.token !== 'string') {
    child.kill()
    throw new Error('invalid sidecar handshake')
  }
  return { child, connection }
}

export async function stopSidecar(child) {
  if (child.exitCode !== null) return
  child.kill()
  await new Promise((resolve) => child.once('exit', resolve))
}