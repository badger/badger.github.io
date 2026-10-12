import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: [new URL('../src/lib/badge-editor-input.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', write: false })
const { BadgeInput, badgeKey } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

test('arrows and letters map to the firmware physical and gamepad groups', () => {
  assert.equal(badgeKey('ArrowLeft'), 16)
  assert.equal(badgeKey('ArrowRight'), 8)
  assert.equal(badgeKey('ArrowUp'), 2)
  assert.equal(badgeKey('ArrowDown'), 1)
  assert.equal(badgeKey(' '), 4)
  assert.equal(badgeKey('Enter'), 4)
  assert.equal(badgeKey('Escape'), 32)
  assert.equal(badgeKey('W'), 2048)
  assert.equal(badgeKey('a'), 256)
  assert.equal(badgeKey('s'), 4096)
  assert.equal(badgeKey('d'), 512)
  assert.equal(badgeKey('j'), 1024)
  assert.equal(badgeKey('k'), 8192)
  assert.equal(badgeKey('u'), 16384)
  assert.equal(badgeKey('Tab'), 0)
})

test('releasing a keyboard key does not release a held model button or another select key', () => {
  const states = []
  const input = new BadgeInput(mask => states.push(mask))
  input.set('model', 16, true)
  input.set('key:ArrowLeft', 16, true)
  input.set('key:ArrowLeft', 16, false)
  assert.equal(states.at(-1), 16)
  input.set('key:Space', 4, true)
  input.set('key:Enter', 4, true)
  input.set('key:Space', 4, false)
  assert.equal(states.at(-1), 20)
  input.set('model', 16, false)
  assert.equal(states.at(-1), 4)
  input.clear()
  assert.equal(states.at(-1), 0)
})
