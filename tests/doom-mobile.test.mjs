import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { build } from 'esbuild'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/doom-mobile.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { initDoomMobile } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
)

class Element extends EventTarget {
  dataset = {}
  attributes = new Map()
  disabled = false
  textContent = ''
  value = ''
  setAttribute(key, value) { this.attributes.set(key, value) }
  getAttribute(key) { return this.attributes.get(key) ?? null }
  removeAttribute(key) { this.attributes.delete(key) }
  setPointerCapture() {}
  blur() { this.blurred = true }
}

function setup(t) {
  const forward = Object.assign(new Element(), { dataset: { doomKey: 'ArrowUp' } })
  const fire = Object.assign(new Element(), { dataset: { doomKey: 'ControlLeft' } })
  const fullscreen = new Element()
  const options = new Element()
  const root = new Element()
  const elements = new Map([
    ['[data-doom-fullscreen]', fullscreen],
    ['[data-doom-view-options]', options],
  ])
  root.querySelector = selector => elements.get(selector) ?? null
  root.querySelectorAll = () => [forward, fire]
  const classes = new Set()
  const document = Object.assign(new EventTarget(), {
    body: { classList: {
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name) },
      remove(name) { classes.delete(name) },
    } },
  })
  const window = Object.assign(new EventTarget(), { setTimeout })
  const previous = new Map()
  for (const [name, value] of Object.entries({ document, window })) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  }
  const abort = new AbortController()
  t.after(() => {
    abort.abort()
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  })
  const keys = []
  let releases = 0
  const mobile = initDoomMobile(root, {
    key: (...args) => keys.push(args),
    release: () => { releases++ },
  }, abort.signal)
  return { root, forward, fire, fullscreen, options, document, window, classes, keys, mobile, abort, releases: () => releases }
}

function pointer(button, type, pointerId) {
  const event = new Event(type, { cancelable: true })
  Object.defineProperties(event, { button: { value: 0 }, pointerId: { value: pointerId } })
  button.dispatchEvent(event)
  return event
}

const settle = () => new Promise(resolve => setImmediate(resolve))

test('touch controls hold movement and fire independently and release on cancellation or cleanup', t => {
  const { forward, fire, keys, mobile, abort } = setup(t)
  assert.equal(pointer(forward, 'pointerdown', 1).defaultPrevented, true)
  pointer(fire, 'pointerdown', 2)
  pointer(fire, 'pointerdown', 3)
  pointer(fire, 'pointerup', 2)
  assert.equal(fire.dataset.pressed, 'true')
  pointer(forward, 'pointercancel', 1)
  pointer(fire, 'lostpointercapture', 3)
  assert.equal(forward.dataset.pressed, 'false')
  assert.equal(fire.dataset.pressed, 'false')
  assert.deepEqual(keys.splice(0), [
    ['touch:1', 'ArrowUp', true],
    ['touch:2', 'ControlLeft', true],
    ['touch:3', 'ControlLeft', true],
    ['touch:2', 'ControlLeft', false],
    ['touch:1', 'ArrowUp', false],
    ['touch:3', 'ControlLeft', false],
  ])
  pointer(forward, 'pointerdown', 4)
  mobile.clear()
  pointer(forward, 'pointerup', 4)
  assert.deepEqual(keys.splice(0), [['touch:4', 'ArrowUp', true], ['touch:4', 'ArrowUp', false]])
  pointer(fire, 'pointerdown', 5)
  abort.abort()
  assert.deepEqual(keys.splice(0), [['touch:5', 'ControlLeft', true], ['touch:5', 'ControlLeft', false]])
})

test('view options and fullscreen fallback toggle accessibly and Escape exits the fallback', async t => {
  const { root, options, fullscreen, window, classes, releases } = setup(t)
  options.dispatchEvent(new Event('click'))
  assert.equal(root.dataset.viewOptions, 'true')
  assert.equal(options.getAttribute('aria-expanded'), 'true')
  options.dispatchEvent(new Event('click'))
  assert.equal(root.dataset.viewOptions, 'false')
  fullscreen.dispatchEvent(new Event('click'))
  await settle()
  assert.equal(root.dataset.fullscreen, 'true')
  assert.equal(fullscreen.getAttribute('aria-label'), 'Exit fullscreen')
  assert.ok(classes.has('doom-fullscreen-open'))
  const escape = new Event('keydown', { cancelable: true })
  Object.defineProperty(escape, 'key', { value: 'Escape' })
  window.dispatchEvent(escape)
  assert.equal(escape.defaultPrevented, true)
  assert.equal(root.dataset.fullscreen, 'false')
  assert.equal(classes.size, 0)
  fullscreen.dispatchEvent(new Event('click'))
  await settle()
  fullscreen.dispatchEvent(new Event('click'))
  await settle()
  assert.equal(root.dataset.fullscreen, 'false')
  assert.equal(releases(), 3)
})

test('native fullscreen follows browser exit and rejected requests use the fallback', async t => {
  const { root, fullscreen, document, classes } = setup(t)
  root.requestFullscreen = async () => {
    document.fullscreenElement = root
    document.dispatchEvent(new Event('fullscreenchange'))
  }
  document.exitFullscreen = async () => {
    document.fullscreenElement = null
    document.dispatchEvent(new Event('fullscreenchange'))
  }
  fullscreen.dispatchEvent(new Event('click'))
  await settle()
  assert.equal(root.dataset.fullscreen, 'true')
  await document.exitFullscreen()
  assert.equal(root.dataset.fullscreen, 'false')
  assert.equal(classes.size, 0)
  root.requestFullscreen = async () => { throw new Error('Denied') }
  fullscreen.dispatchEvent(new Event('click'))
  await settle()
  assert.equal(root.dataset.fullscreen, 'true')
})

test('simulator fullscreen events do not reach the engine canvas fullscreen handler', t => {
  const { root, document } = setup(t)
  document.fullscreenElement = root
  const event = new Event('fullscreenchange', { bubbles: true })
  root.dispatchEvent(event)
  assert.equal(event.cancelBubble, true)
  assert.equal(root.dataset.fullscreen, 'true')
  document.fullscreenElement = null
  root.dispatchEvent(new Event('fullscreenchange', { bubbles: true }))
  assert.equal(root.dataset.fullscreen, 'false')
})
