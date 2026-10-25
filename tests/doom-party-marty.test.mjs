import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/doom-party-marty.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { createPartyMarty, hasDoomHud, createDoomPowerMode } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

test('avatar and Party Marty share an idempotent power mode with repeated ammo refills', t => {
  class KeyboardEvent extends Event {
    constructor(type, options) {
      super(type)
      for (const [key, value] of Object.entries(options)) Object.defineProperty(this, key, { value })
    }
  }
  const previous = new Map()
  const document = new EventTarget()
  for (const [key, value] of Object.entries({ KeyboardEvent, document })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  const keys = []
  const state = { session: 1, gameplay: false, godMode: false }
  let cheatCursor = 0
  document.addEventListener('keydown', event => {
    keys.push(event.key)
    cheatCursor = event.key === 'iddqd'[cheatCursor] ? cheatCursor + 1 : 0
    if (cheatCursor === 5) {
      state.godMode = !state.godMode
      cheatCursor = 0
    }
  })
  const power = createDoomPowerMode(() => state)
  power.activate()
  for (let now = 0; now < 1000; now += 60) power.render(false, now)
  assert.deepEqual(keys, [])
  for (let now = 0; now < 1000; now += 60) power.render(true, now)
  assert.deepEqual(keys, [], 'A demo HUD must not start cheats')
  state.session++
  state.gameplay = true
  for (let now = 1000; now < 2000; now += 60) power.render(true, now)
  assert.equal(keys.join(''), 'xiddqdidkfa')
  assert.equal(state.godMode, true)
  power.activate()
  power.activate()
  for (let now = 6000; now < 6500; now += 60) power.render(true, now)
  assert.equal(keys.join(''), 'xiddqdidkfaidkfa')
  for (let now = 11000; now < 12000; now += 60) power.render(false, now)
  assert.equal(keys.join(''), 'xiddqdidkfaidkfa', 'Ammo refills must not send cheat keys outside gameplay')
  state.session++
  state.godMode = false
  power.render(true, 13000)
  assert.equal(keys.at(-1), 'x')
  power.render(true, 13060)
  power.render(true, 13120)
  assert.equal(cheatCursor, 2)
  state.gameplay = false
  power.render(false, 13200)
  state.gameplay = true
  const restart = keys.length
  for (let now = 14000; now < 15000; now += 60) power.render(true, now)
  assert.equal(keys.slice(restart).join(''), 'xiddqdidkfa', 'Interrupted initialization resets the native parser and restarts from its first character')
  assert.equal(state.godMode, true, 'Restarting after a partial id prefix must actually enable god mode')
  state.session++
  state.godMode = false
  const nextGame = keys.length
  for (let now = 15000; now < 16000; now += 60) power.render(true, now)
  assert.equal(keys.slice(nextGame).join(''), 'xiddqdidkfa', 'A new game gets its own complete initialization')
  assert.equal(state.godMode, true)
  state.session++
  state.godMode = false
  for (let now = 16000; now < 16360; now += 60) power.render(true, now)
  assert.equal(state.godMode, true)
  state.gameplay = false
  power.render(false, 16400)
  state.gameplay = true
  const alreadyGod = keys.length
  for (let now = 17000; now < 18000; now += 60) power.render(true, now)
  assert.equal(keys.slice(alreadyGod).join(''), 'xidkfa', 'Resuming initialization must not toggle existing god mode off')
  assert.equal(state.godMode, true)
})

async function hudContext() {
  const wad = await readFile(new URL('../public/doom/DOOM1.WAD', import.meta.url))
  const directory = wad.readInt32LE(8)
  const lumps = new Map()
  for (let i = 0; i < wad.readInt32LE(4); i++) {
    const offset = directory + i * 16
    lumps.set(wad.toString('ascii', offset + 8, offset + 16).replace(/\0/g, ''), wad.subarray(wad.readInt32LE(offset), wad.readInt32LE(offset) + wad.readInt32LE(offset + 4)))
  }
  const bar = lumps.get('STBAR')
  const palette = lumps.get('PLAYPAL')
  const data = new Uint8ClampedArray(320 * 32 * 4)
  for (let x = 0; x < 320; x++) {
    let offset = bar.readInt32LE(8 + x * 4)
    while (bar[offset] !== 255) {
      const top = bar[offset++]
      const count = bar[offset++]
      offset++
      for (let y = 0; y < count; y++) {
        const color = bar[offset++] * 3
        data.set([...palette.subarray(color, color + 3), 255], ((top + y) * 320 + x) * 4)
      }
      offset++
    }
  }
  // Ammo digits cover these parts of STBAR in a real frame.
  for (const [x, y] of [[3, 3], [6, 12]]) data.set([164, 0, 0, 255], (y * 320 + x) * 4)
  const draws = []
  return { data, draws, imageSmoothingEnabled: true, getImageData: () => ({ data }), drawImage: (...args) => draws.push(args) }
}

test('HUD detection tolerates ammo digits and palette changes but rejects non-game screens', async () => {
  const context = await hudContext()
  assert.equal(hasDoomHud(context), true)
  for (let i = 0; i < context.data.length; i += 4) context.data[i + 1] = context.data[i + 1] * 0.7 + 25
  assert.equal(hasDoomHud(context), true)
  context.data.fill(0)
  assert.equal(hasDoomHud(context), false)
})

test('Party Marty is typed once, replaces only the HUD face, grants god mode, and refills ammo', async t => {
  class Element extends EventTarget {
    closest() { return null }
  }
  class KeyboardEvent extends Event {
    constructor(type, options) {
      super(type, options)
      for (const [key, value] of Object.entries(options)) Object.defineProperty(this, key, { value })
    }
  }
  const previous = new Map()
  const document = new EventTarget()
  const window = new EventTarget()
  for (const [key, value] of Object.entries({ Element, KeyboardEvent, document, window })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  const root = new Element()
  let plays = 0
  let pauses = 0
  let rejectPlay
  const video = Object.assign(new Element(), {
    readyState: 4,
    play: () => {
      plays++
      return new Promise((_resolve, reject) => { rejectPlay = reject })
    },
    pause: () => { pauses++ },
    removeAttribute(name) { delete this[name] },
    load() {},
  })
  const errors = []
  const abort = new AbortController()
  const power = createDoomPowerMode(() => ({ session: 1, gameplay: true, godMode: false }))
  const party = createPartyMarty(root, video, abort.signal, message => errors.push(message), power)
  const typed = (text, modifiers = {}) => {
    for (const key of text) root.dispatchEvent(new KeyboardEvent('keydown', { key, ...modifiers }))
  }
  const keys = []
  const characters = []
  document.addEventListener('keydown', event => keys.push(event.key))
  document.addEventListener('keypress', event => characters.push(String.fromCharCode(event.charCode)))
  const context = await hudContext()
  typed('partymarty', { ctrlKey: true })
  typed('partymartx')
  assert.equal(plays, 0)
  typed('PARTYMARTY')
  assert.equal(plays, 1)
  assert.equal(video.src, '/doom/partymarty.mp4')
  typed('partymarty')
  assert.equal(plays, 1)
  for (let now = 0; now < 1000; now += 60) party.render(context, now)
  assert.equal(keys.join(''), 'xiddqdidkfa')
  assert.equal(characters.join(''), 'xiddqdidkfa')
  assert.deepEqual(context.draws[0], [video, 143, 169, 35, 31])
  assert.equal(context.imageSmoothingEnabled, true)
  for (let now = 5000; now < 5500; now += 60) party.render(context, now)
  assert.equal(keys.join(''), 'xiddqdidkfaidkfa')
  party.setPaused(true)
  rejectPlay(new DOMException('Playback interrupted by pause', 'AbortError'))
  await Promise.resolve()
  assert.deepEqual(errors, [])
  const draws = context.draws.length
  party.render(context, 10000)
  assert.equal(context.draws.length, draws)
  assert.equal(pauses, 1)
  party.setPaused(false)
  assert.equal(plays, 2)
  context.data.fill(0)
  party.render(context, 10000)
  assert.equal(context.draws.length, draws)
  party.setFaceEnabled(false)
  assert.equal(pauses, 2)
  typed('partymarty')
  assert.equal(plays, 3)
  assert.equal(keys.join('').match(/iddqd/g).length, 1)
  party.dispose()
  rejectPlay(new DOMException('Playback interrupted by disposal', 'AbortError'))
  await Promise.resolve()
  abort.abort()
  assert.equal(video.src, undefined)
  assert.deepEqual(errors, [])
})
