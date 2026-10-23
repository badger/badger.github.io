import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decodeDoomHud } from './helpers/doom-hud.mjs'

test('HUD decoder reads palette and column posts, rejecting missing or malformed WADs', () => {
  const palette = Buffer.alloc(768)
  palette.set([20, 30, 40], 3)
  const patch = Buffer.alloc(20)
  patch.writeUInt16LE(1, 0)
  patch.writeUInt16LE(2, 2)
  patch.writeUInt32LE(12, 8)
  patch.set([0, 2, 0, 1, 1, 0, 255], 12)
  const directory = 12 + palette.length + patch.length
  const wad = Buffer.alloc(directory + 32)
  wad.write('IWAD')
  wad.writeUInt32LE(2, 4)
  wad.writeUInt32LE(directory, 8)
  palette.copy(wad, 12)
  patch.copy(wad, 12 + palette.length)
  for (const [index, name, offset, size] of [
    [0, 'PLAYPAL', 12, palette.length], [1, 'STBAR', 12 + palette.length, patch.length],
  ]) {
    wad.writeUInt32LE(offset, directory + index * 16)
    wad.writeUInt32LE(size, directory + index * 16 + 4)
    wad.write(name, directory + index * 16 + 8)
  }
  assert.deepEqual(decodeDoomHud(wad), { width: 1, height: 2, pixels: [20, 30, 40, 255, 20, 30, 40, 255] })
  assert.throws(() => decodeDoomHud(Buffer.from('bad')), /WAD/)
  wad.write('ABSENT', directory + 24)
  assert.throws(() => decodeDoomHud(wad), /STBAR/)
})
