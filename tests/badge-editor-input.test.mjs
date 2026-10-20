import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/badge-editor-input.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })
const { BadgeInput, badgeKey, initBadgeKeyboard } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

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

class FakeNode {}
class FakeElement extends FakeNode {
  constructor(selectors = []) { super(); this.selectors = selectors }
  closest(selector) { return selector.split(',').some(part => this.selectors.includes(part.trim())) ? this : null }
}

function harness() {
  const listeners = new Map()
  const on = target => ({
    addEventListener: (type, fn) => listeners.set(`${target}:${type}`, fn),
    removeEventListener: type => listeners.delete(`${target}:${type}`),
  })
  const inside = new FakeElement()
  const scope = { ...on('scope'), contains: node => node === inside }
  const previous = { window: globalThis.window, Element: globalThis.Element, Node: globalThis.Node }
  Object.assign(globalThis, { window: on('window'), Element: FakeElement, Node: FakeNode })
  const states = []
  const dispose = initBadgeKeyboard(scope, new BadgeInput(mask => states.push(mask)))
  const fire = (target, type, init = {}) => {
    const event = { type, key: '', code: '', target: new FakeElement(), metaKey: false, ctrlKey: false, altKey: false, isComposing: false, prevented: false, preventDefault() { this.prevented = true }, stopPropagation() {}, ...init }
    listeners.get(`${target}:${type}`)?.(event)
    return event
  }
  const restore = () => { dispose(); Object.assign(globalThis, previous) }
  return { fire, states, inside, listeners, restore }
}

test('keyboard events press and release badge buttons through the scope', () => {
  const { fire, states, restore } = harness()
  try {
    assert.equal(fire('scope', 'keydown', { key: 'ArrowLeft', code: 'ArrowLeft' }).prevented, true)
    assert.equal(states.at(-1), 16)
    fire('scope', 'keydown', { key: 'j', code: 'KeyJ' })
    assert.equal(states.at(-1), 16 | 1024)
    assert.equal(fire('scope', 'keyup', { key: 'ArrowLeft', code: 'ArrowLeft' }).prevented, true)
    assert.equal(states.at(-1), 1024)
    assert.equal(fire('scope', 'keydown', { key: 'Tab', code: 'Tab' }).prevented, false)
    assert.equal(states.at(-1), 1024)
  } finally { restore() }
})

test('keyboard input ignores modifiers, editable targets, composition, and button activation keys', () => {
  const { fire, states, restore } = harness()
  try {
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }]) fire('scope', 'keydown', { key: 'a', code: 'KeyA', ...init })
    for (const selector of ['input', 'textarea', 'select', '[contenteditable="true"]', '[role="textbox"]']) fire('scope', 'keydown', { key: 'a', code: 'KeyA', target: new FakeElement([selector]) })
    fire('scope', 'keydown', { key: ' ', code: 'Space', target: new FakeElement(['button']) })
    fire('scope', 'keydown', { key: 'Enter', code: 'Enter', target: new FakeElement(['button']) })
    assert.deepEqual(states, [])
    fire('scope', 'keydown', { key: 'ArrowUp', code: 'ArrowUp', target: new FakeElement(['button']) })
    assert.equal(states.at(-1), 2)
  } finally { restore() }
})

test('held keys release when focus leaves the scope or the window blurs', () => {
  const { fire, states, inside, listeners, restore } = harness()
  try {
    fire('scope', 'keydown', { key: 'ArrowDown', code: 'ArrowDown' })
    fire('scope', 'focusout', { relatedTarget: inside })
    assert.equal(states.at(-1), 1)
    fire('scope', 'focusout', { relatedTarget: new FakeElement() })
    assert.equal(states.at(-1), 0)
    fire('scope', 'keydown', { key: 'ArrowDown', code: 'ArrowDown' })
    fire('scope', 'focusout', { relatedTarget: null })
    assert.equal(states.at(-1), 0)
    fire('scope', 'keydown', { key: 'd', code: 'KeyD' })
    listeners.get('window:blur')()
    assert.equal(states.at(-1), 0)
    assert.equal(fire('scope', 'keyup', { key: 'd', code: 'KeyD' }).prevented, false)
  } finally { restore() }
  assert.equal(listeners.size, 0)
})