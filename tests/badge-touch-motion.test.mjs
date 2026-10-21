import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

async function load(path) {
  const compiled = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
}

const { badgeMotion } = await load('../src/lib/badge-motion.ts')
const { touchPadAt, touchPads, zoomStep } = await load('../src/lib/badge-editor-model.ts')

test('device motion maps to badge IMU readings with screen rotation undone', () => {
  assert.deepEqual(badgeMotion({ x: 0, y: 0, z: 9.80665 }, null), [0, 0, -16384, 0, 0, 0])
  assert.deepEqual(badgeMotion({ x: 9.80665, y: 0, z: 0 }, { alpha: 1, beta: 2, gamma: 3 }), [16384, 0, 0, 29, -43, -14])
  assert.deepEqual(badgeMotion({ x: 9.80665, y: 0, z: 0 }, null, 90), [0, -16384, 0, 0, 0, 0])
  assert.deepEqual(badgeMotion({ x: 9.80665, y: 0, z: 0 }, null, 180), [-16384, 0, 0, 0, 0, 0])
  assert.deepEqual(badgeMotion({ x: 0, y: 9.80665, z: 0 }, null, 270), [16384, 0, 0, 0, 0, 0])
  assert.deepEqual(badgeMotion({ x: 0, y: 0, z: 100 }, null), [0, 0, -32768, 0, 0, 0])
  assert.equal(badgeMotion({ x: null, y: null, z: null }, null), null)
})

test('printed touch pads map to the gamepad bits used by input_test', () => {
  const at = (x, y) => touchPadAt(x / 422, y / 534)
  assert.equal(at(117, 425), 1024)
  assert.equal(at(73, 469), 8192)
  assert.equal(at(315, 420), 2048)
  assert.equal(at(280, 457), 256)
  assert.equal(at(350, 457), 512)
  assert.equal(at(315, 492), 4096)
  assert.equal(at(176, 486), 16384)
  assert.equal(at(211, 486), 32)
  assert.equal(at(211, 100), 0)
  assert.equal(new Set(touchPads.map(pad => pad.bit)).size, touchPads.length)
  assert.equal(zoomStep, 0.05)
})
