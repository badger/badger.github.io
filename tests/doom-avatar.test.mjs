import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { build } from 'esbuild'
import { once } from 'node:events'
import { decodeDoomHud } from './helpers/doom-hud.mjs'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/doom-avatar.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { DoomUsernameInput, githubUsername, doomPalette, palettePixels, createDoomAvatar } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
)

test('@ input captures through Enter, supports corrections and cancellation, and leaves normal cheats alone', () => {
  const input = new DoomUsernameInput()
  assert.deepEqual(input.key('i'), { captured: false })
  for (const key of '@leereilx') assert.equal(input.key(key).captured, true)
  assert.equal(input.key('Backspace').captured, true)
  for (const key of 'ly') input.key(key)
  assert.deepEqual(input.key('Enter'), { captured: true, username: 'leereilly' })
  assert.deepEqual(input.key('Enter'), { captured: false })
  input.key('@')
  input.key('x')
  input.key('Escape')
  assert.deepEqual(input.key('Enter'), { captured: false })
  input.key('@')
  input.key('a')
  input.reset()
  assert.deepEqual(input.key('Enter'), { captured: false })
})

test('GitHub usernames reject paths, whitespace, overlong handles, and malformed URL values', () => {
  assert.equal(githubUsername('LeeReilly'), 'leereilly')
  assert.equal(githubUsername('octo-cat'), 'octo-cat')
  for (const name of ['', '../x', 'x.png', 'a b', '@user', '-user', 'user-', 'a--b', 'a'.repeat(40)]) {
    assert.equal(githubUsername(name), null, name)
  }
})

test('avatar pixels map to the exact bundled Doom palette and blend transparency', async () => {
  const wad = await readFile(new URL('../public/doom/DOOM1.WAD', import.meta.url))
  const palette = doomPalette(wad)
  assert.equal(palette.length, 768)
  const pixels = new Uint8ClampedArray([249, 23, 30, 255, 0, 0, 0, 0])
  palettePixels(pixels, palette)
  const colors = new Set(Array.from({ length: 256 }, (_, i) => [...palette.slice(i * 3, i * 3 + 3)].join(',')))
  assert.ok(colors.has([...pixels.slice(0, 3)].join(',')))
  assert.equal(pixels[3], 255)
  assert.equal(pixels[7], 255)
  assert.throws(() => doomPalette(new Uint8Array(12)), /WAD/)
})

test('avatar controller captures gameplay input, uses the CORS fallback, and ignores superseded loads', async t => {
  const wad = await readFile(new URL('../public/doom/DOOM1.WAD', import.meta.url))
  class Element extends EventTarget {
    closest() { return null }
  }
  class KeyboardEvent extends Event {
    constructor(type, key) {
      super(type, { cancelable: true })
      this.key = key
      this.code = key === 'Enter' ? 'Enter' : `Key${key.toUpperCase()}`
    }
  }
  const sources = []
  class Image {
    naturalWidth = 128
    naturalHeight = 128
    set src(value) {
      sources.push(value)
      queueMicrotask(() => {
        if (value.includes('github.com/')) this.onerror?.()
        else this.onload?.()
      })
    }
  }
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({
      drawImage() {},
      getImageData: () => ({ data: new Uint8ClampedArray(35 * 31 * 4).fill(128) }),
      putImageData() {},
    }),
  }
  const model = { dataset: {} }
  const root = new Element()
  root.querySelector = selector => selector === '[data-doom-model]' ? model : null
  const document = Object.assign(new EventTarget(), { createElement: () => canvas })
  const location = new URL('https://badger.github.io/virtual/')
  const previous = new Map()
  const globals = {
    Element, Image, document, location, window: new EventTarget(),
    history: { state: null, replaceState(_state, _title, url) { location.href = url.href } },
    fetch: async () => ({ ok: true, arrayBuffer: async () => wad.buffer.slice(wad.byteOffset, wad.byteOffset + wad.byteLength) }),
  }
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const abort = new AbortController()
  t.after(() => {
    abort.abort()
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  let powers = 0
  let releases = 0
  const avatar = createDoomAvatar(root, abort.signal, { activate() { powers++ }, render() {} }, () => { releases++ })
  avatar.render({ getImageData: () => ({ data: new Uint8ClampedArray(320 * 32 * 4) }) })
  for (const key of [...'@leereilly', 'Enter']) {
    const event = new KeyboardEvent('keydown', key)
    root.dispatchEvent(event)
    assert.equal(event.defaultPrevented, false, 'Title/menu input must not trigger the avatar cheat')
  }
  assert.equal(powers, 0)
  assert.equal(sources.length, 0)
  const hud = decodeDoomHud(wad)
  const draws = []
  const context = { imageSmoothingEnabled: true, getImageData: () => ({ data: hud.pixels }), drawImage: (...args) => draws.push(args) }
  avatar.render(context)
  const menuPixels = new Uint8ClampedArray(320 * 200 * 4)
  menuPixels.set(hud.pixels, 168 * 320 * 4)
  const directory = wad.readUInt32LE(8)
  for (let i = 0; i < wad.readUInt32LE(4); i++) {
    const entry = directory + i * 16
    if (wad.toString('ascii', entry + 8, entry + 16).replace(/\0/g, '') !== 'M_SKULL1') continue
    const patch = wad.subarray(wad.readUInt32LE(entry), wad.readUInt32LE(entry) + wad.readUInt32LE(entry + 4))
    const palette = doomPalette(wad)
    for (let x = 0; x < patch.readUInt16LE(0); x++) {
      let offset = patch.readUInt32LE(8 + x * 4)
      while (patch[offset] !== 255) {
        const top = patch[offset++]
        const count = patch[offset++]
        offset++
        for (let y = 0; y < count; y++) {
          const color = patch[offset++] * 3
          menuPixels.set([...palette.subarray(color, color + 3), 255], ((59 + top + y) * 320 + 65 + x) * 4)
        }
        offset++
      }
    }
  }
  const menuContext = { getImageData: (_x, y) => ({ data: y === 168 ? hud.pixels : menuPixels }) }
  root.dispatchEvent(new KeyboardEvent('keydown', '@'))
  root.dispatchEvent(new KeyboardEvent('keydown', 'x'))
  avatar.render(menuContext)
  const menuEnter = new KeyboardEvent('keydown', 'Enter')
  root.dispatchEvent(menuEnter)
  assert.equal(menuEnter.defaultPrevented, false, 'Opening a menu must cancel partial username input')
  for (const key of [...'@octocat', 'Enter']) root.dispatchEvent(new KeyboardEvent('keydown', key))
  assert.equal(powers, 0, 'Menus over the gameplay HUD must not activate the cheat')
  avatar.render(context)
  const strayEnter = new KeyboardEvent('keydown', 'Enter')
  root.dispatchEvent(strayEnter)
  assert.equal(strayEnter.defaultPrevented, false, 'Partial menu input must not survive returning to gameplay')
  const typed = text => {
    for (const key of text) {
      const event = new KeyboardEvent('keydown', key)
      root.dispatchEvent(event)
      assert.equal(event.defaultPrevented, true)
    }
    root.dispatchEvent(new KeyboardEvent('keydown', 'Enter'))
  }
  const changed = once(document, 'doom:avatar-change', { signal: AbortSignal.timeout(2000) })
  typed('@leereilly')
  typed('@octocat')
  const heldEnter = new KeyboardEvent('keydown', 'Enter')
  heldEnter.repeat = true
  root.dispatchEvent(heldEnter)
  assert.equal(heldEnter.defaultPrevented, true)
  const [changeEvent] = await changed
  assert.equal(changeEvent.detail.fromURL, false)
  assert.equal(model.dataset.avatar, 'octocat')
  assert.equal(location.search, '?u=octocat')
  assert.equal(location.pathname, '/virtual')
  assert.equal(powers, 2)
  assert.ok(releases > 0)
  assert.ok(sources.includes('https://github.com/octocat.png?size=128'))
  assert.ok(sources.includes('https://avatars.githubusercontent.com/octocat?s=128'))
  avatar.render(context)
  assert.equal(avatar.visible(), true)
  assert.deepEqual(draws[0], [canvas, 143, 169, 35, 31])
  avatar.render(menuContext)
  assert.equal(avatar.visible(), false)
  assert.equal(draws.length, 1)
  avatar.setPaused(true)
  avatar.render(context)
  assert.equal(avatar.visible(), false)
  assert.equal(draws.length, 1)
  avatar.clear()
  assert.equal(model.dataset.avatar, undefined)
  assert.equal(location.search, '')
  avatar.dispose()
})
