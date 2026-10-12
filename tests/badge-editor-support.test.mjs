import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { runInNewContext } from 'node:vm'

test('simulator lazy filesystem sizes match the shipped modules and assets', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/simulator/filesystem.json', import.meta.url), 'utf8'))
  for (const [path, size] of Object.entries(manifest.files)) {
    const data = await readFile(new URL(`../public/simulator/filesystem${path}`, import.meta.url))
    assert.equal(data.byteLength, size, path)
  }
})

test('Contacts firmware helpers render locally without pretending to connect or send data', () => {
  const output = execFileSync('python3', [new URL('./fixtures/badge-editor-support.py', import.meta.url).pathname], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } })
  assert.match(output, /badge-to-badge communication is unavailable/)
  assert.match(output, /Contacts helper checks passed/)
})

test('display rotation preserves pixel channels and worker transfer lists', async () => {
  const delivered = []
  const self = { postMessage: (...args) => delivered.push(args) }
  runInNewContext(await readFile(new URL('../public/simulator/editor-host.js', import.meta.url), 'utf8'), { self, Uint8Array })
  const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255])
  const message = { frame: { buffer: pixels.buffer, width: 2, height: 2 } }
  const transfer = [pixels.buffer]
  self.sim_display_rotation(true)
  self.postMessage(message, transfer)
  assert.deepEqual([...pixels], [255, 255, 255, 255, 0, 0, 255, 255, 0, 255, 0, 255, 255, 0, 0, 255])
  assert.equal(delivered[0][0], message)
  assert.equal(delivered[0][1], transfer)
  self.sim_display_rotation(false)
  self.postMessage(message, transfer)
  assert.deepEqual([...pixels], [255, 255, 255, 255, 0, 0, 255, 255, 0, 255, 0, 255, 255, 0, 0, 255])
  const status = { running: true }
  self.sim_display_rotation(true)
  self.postMessage(status)
  assert.equal(delivered[2][0], status)
})
