import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/doom-input.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })
const { badgeDoomKey, doomKey, DoomInput, DoomUseDoubleTap, initDoomKeyboard } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

test('cheat letters reach SDL once with canonical codes even when native legacy codes are missing', t => {
  class Element extends EventTarget {
    closest() { return this.editing ? this : null }
  }
  class KeyboardEvent extends Event {
    constructor(type, options) {
      super(type, options)
      for (const [key, value] of Object.entries(options)) Object.defineProperty(this, key, { value })
    }
  }
  const previous = new Map()
  const document = new EventTarget()
  for (const [name, value] of Object.entries({ Element, KeyboardEvent, document, window: new EventTarget() })) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  }
  t.after(() => {
    dispose()
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  })
  const scope = new Element()
  const actions = []
  const dispose = initDoomKeyboard(scope, new DoomInput((...args) => actions.push(args)))
  const characters = []
  const keys = []
  document.addEventListener('keypress', event => characters.push(String.fromCharCode(event.charCode)))
  document.addEventListener('keydown', event => keys.push(event.keyCode))
  for (const text of ['IDSPISPOPD', 'idspispopd']) {
    for (const letter of text) {
      for (const type of ['keydown', 'keypress', 'keyup']) {
        const event = new KeyboardEvent(type, { key: letter, code: `Key${letter.toUpperCase()}`, keyCode: 0, charCode: 0, bubbles: true })
        scope.dispatchEvent(event)
        if (!event.cancelBubble) document.dispatchEvent(event)
      }
    }
  }
  assert.equal(characters.join(''), 'idspispopdidspispopd')
  assert.deepEqual(keys, [...'IDSPISPOPDIDSPISPOPD'].map(letter => letter.charCodeAt(0)))
  assert.deepEqual(actions, [])
  for (const options of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }, { isComposing: true }]) {
    scope.dispatchEvent(new KeyboardEvent('keypress', { key: 'I', code: 'KeyI', ...options }))
  }
  scope.editing = true
  scope.dispatchEvent(new KeyboardEvent('keypress', { key: 'I', code: 'KeyI' }))
  assert.equal(characters.length, 20)
})

test('each arrow press reaches the engine once rather than skipping a menu option', t => {
  const previous = new Map()
  class Element extends EventTarget {
    closest() { return null }
  }
  for (const [name, value] of Object.entries({ Element, window: new EventTarget() })) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  }
  t.after(() => {
    dispose()
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  })
  const scope = new Element()
  const changes = []
  const engine = (key, pressed) => changes.push([key, pressed])
  const dispose = initDoomKeyboard(scope, new DoomInput(engine))
  for (const code of ['ArrowDown', 'ArrowUp']) {
    for (const type of ['keydown', 'keydown', 'keyup']) {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'code', { value: code })
      scope.dispatchEvent(event)
      if (!event.cancelBubble) engine(code, type === 'keydown')
    }
  }
  assert.deepEqual(changes, [
    ['ArrowDown', true], ['ArrowDown', false],
    ['ArrowUp', true], ['ArrowUp', false],
  ])
})

test('keyboard activation of badge links and disclosure summaries is not captured as Doom input', t => {
  const previous = new Map()
  class Element extends EventTarget {
    constructor(tag) { super(); this.tag = tag }
    closest(selector) { return selector.split(', ').includes(this.tag) ? this : null }
  }
  for (const [name, value] of Object.entries({ Element, window: new EventTarget() })) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  }
  t.after(() => {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  })
  const changes = []
  for (const tag of ['button', 'a[href]', 'summary']) {
    const target = new Element(tag)
    const dispose = initDoomKeyboard(target, new DoomInput((...args) => changes.push(args)))
    for (const code of ['Enter', 'Space']) {
      for (const type of ['keydown', 'keypress', 'keyup']) {
        const event = new Event(type, { cancelable: true })
        Object.defineProperty(event, 'code', { value: code })
        target.dispatchEvent(event)
        assert.equal(event.defaultPrevented, false, `${tag}: ${type} ${code}`)
        assert.equal(event.cancelBubble, true, `${tag}: ${type} ${code} must not reach SDL`)
      }
    }
    dispose()
  }
  assert.deepEqual(changes, [])
})

test('Doom keyboard controls are independent from MicroPython mappings', () => {
  assert.equal(doomKey({ code: 'ArrowLeft' }), 'ArrowLeft')
  assert.equal(doomKey({ code: 'ControlRight' }), 'ControlLeft')
  assert.equal(doomKey({ code: 'KeyJ' }), 'ControlLeft')
  assert.equal(doomKey({ code: 'Space' }), 'Space')
  assert.equal(doomKey({ code: 'KeyK' }), 'Space')
  assert.equal(doomKey({ code: 'ShiftRight' }), 'ShiftLeft')
  assert.equal(doomKey({ code: 'AltRight' }), 'AltLeft')
  assert.equal(doomKey({ code: 'Escape' }), 'Escape')
  assert.equal(doomKey({ code: 'Enter' }), 'Enter')
  assert.equal(doomKey({ code: 'KeyW' }), undefined)
})

test('badge and printed touch controls map to Doom actions', () => {
  assert.equal(badgeDoomKey(256), 'ArrowLeft')
  assert.equal(badgeDoomKey(512), 'ArrowRight')
  assert.equal(badgeDoomKey(2048), 'ArrowUp')
  assert.equal(badgeDoomKey(4096), 'ArrowDown')
  assert.equal(badgeDoomKey(1024), 'ControlLeft')
  assert.equal(badgeDoomKey(8192), 'Space')
  assert.equal(badgeDoomKey(16384), 'AltLeft')
  assert.equal(badgeDoomKey(32), 'Escape')
  assert.equal(badgeDoomKey(16), 'ArrowLeft')
  assert.equal(badgeDoomKey(8), 'ControlLeft')
  assert.equal(badgeDoomKey(4), 'ArrowRight')
  assert.equal(badgeDoomKey(2), 'ArrowUp')
  assert.equal(badgeDoomKey(1), 'ArrowDown')
})

test('middle badge button uses only after two short taps and consumes the pair', () => {
  const tap = new DoomUseDoubleTap()
  assert.equal(tap.set(true, 0), false)
  assert.equal(tap.set(false, 50), false)
  assert.equal(tap.set(true, 100), false)
  assert.equal(tap.set(false, 150), true)
  assert.equal(tap.set(false, 160), false)
  assert.equal(tap.set(true, 200), false)
  assert.equal(tap.set(false, 250), false)
})

test('slow taps, held fire, repeated presses, and focus resets do not trigger use', () => {
  const tap = new DoomUseDoubleTap()
  tap.set(true, 0)
  tap.set(false, 50)
  tap.set(true, 400)
  assert.equal(tap.set(false, 450), false)
  tap.set(true, 500)
  assert.equal(tap.set(true, 800), false)
  assert.equal(tap.set(false, 850), false)
  tap.set(true, 900)
  assert.equal(tap.set(false, 950), false)
  tap.clear()
  tap.set(true, 1000)
  assert.equal(tap.set(false, 1050), false)
})

test('rotated badge and touch directions remain viewer-relative', () => {
  assert.equal(badgeDoomKey(256, true), 'ArrowRight')
  assert.equal(badgeDoomKey(512, true), 'ArrowLeft')
  assert.equal(badgeDoomKey(2048, true), 'ArrowDown')
  assert.equal(badgeDoomKey(4096, true), 'ArrowUp')
  assert.equal(badgeDoomKey(2, true), 'ArrowDown')
  assert.equal(badgeDoomKey(1, true), 'ArrowUp')
  assert.equal(badgeDoomKey(1024, true), 'ControlLeft')
})

test('multiple input sources do not release an action until its final source releases', () => {
  const changes = []
  const input = new DoomInput((key, pressed) => changes.push([key, pressed]))
  input.set('keyboard', 'ControlLeft', true)
  input.set('badge', 'ControlLeft', true)
  input.set('keyboard', 'ControlLeft', false)
  assert.deepEqual(changes, [['ControlLeft', true]])
  input.set('badge', 'ControlLeft', false)
  assert.deepEqual(changes.at(-1), ['ControlLeft', false])
})

test('held physical directions remap safely across repeated orientation toggles', () => {
  const changes = []
  const input = new DoomInput((key, pressed) => changes.push([key, pressed]))
  input.set('touch:left', badgeDoomKey(256, false), true)
  input.set('touch:left', badgeDoomKey(256, true), true)
  input.set('touch:left', badgeDoomKey(256, false), true)
  input.set('touch:left', badgeDoomKey(256, false), false)
  assert.deepEqual(changes, [
    ['ArrowLeft', true],
    ['ArrowLeft', false],
    ['ArrowRight', true],
    ['ArrowRight', false],
    ['ArrowLeft', true],
    ['ArrowLeft', false],
  ])
})
