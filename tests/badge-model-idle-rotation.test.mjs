import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/badge-model-idle-rotation.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })
const { initBadgeIdleRotation } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

function fixture(t) {
  let now = 0
  let id = 0
  const frames = new Map()
  const timers = new Map()
  const host = Object.assign(new EventTarget(), { matches: () => false })
  const document = Object.assign(new EventTarget(), { hidden: false })
  const motion = Object.assign(new EventTarget(), { matches: false })
  const window = Object.assign(new EventTarget(), { matchMedia: () => motion })
  let observer
  const globals = {
    document,
    window,
    requestAnimationFrame(callback) { frames.set(++id, callback); return id },
    cancelAnimationFrame(id) { frames.delete(id) },
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; observer = this }
      observe() {}
      disconnect() { this.disconnected = true }
    },
  }
  const restore = []
  for (const [name, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
    restore.push(() => {
      if (previous) Object.defineProperty(globalThis, name, previous)
      else delete globalThis[name]
    })
  }
  t.mock.method(performance, 'now', () => now)
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    timers.set(++id, { callback, at: now + delay })
    return id
  })
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id))
  const rotations = []
  const rotation = initBadgeIdleRotation(host, seconds => rotations.push(seconds))
  t.after(() => {
    rotation.dispose()
    for (const reset of restore) reset()
  })
  const advance = ms => {
    now += ms
    for (const [id, timer] of timers) {
      if (timer.at > now) continue
      timers.delete(id)
      timer.callback()
    }
  }
  const frame = (ms = 16) => {
    advance(ms)
    const pending = [...frames.values()]
    frames.clear()
    for (const callback of pending) callback(now)
  }
  const send = (target, type, properties = {}) => {
    const event = new Event(type)
    Object.assign(event, properties)
    target.dispatchEvent(event)
  }
  return { host, document, window, motion, observer, rotations, rotation, frames, timers, advance, frame, send }
}

test('starts slowly, stays stopped throughout hover, and resumes 30 seconds after leaving', t => {
  const f = fixture(t)
  f.frame()
  f.frame(50)
  assert.deepEqual(f.rotations, [0.05])
  f.send(f.host, 'pointerenter', { pointerType: 'mouse' })
  assert.equal(f.frames.size, 0)
  f.advance(60_000)
  assert.equal(f.frames.size, 0)
  f.send(f.host, 'pointerleave')
  f.advance(29_999)
  assert.equal(f.frames.size, 0)
  f.advance(1)
  assert.equal(f.frames.size, 1)
  f.frame()
  assert.deepEqual(f.rotations, [0.05])
  f.frame(50)
  assert.deepEqual(f.rotations, [0.05, 0.05])
})

test('dragging and held gameplay keys prevent idle rotation until 30 seconds after release', t => {
  const f = fixture(t)
  f.send(f.document, 'pointerdown', { pointerId: 1 })
  f.send(f.host, 'pointerleave')
  f.advance(60_000)
  assert.equal(f.frames.size, 0)
  f.send(f.window, 'pointerup', { pointerId: 1 })
  f.advance(30_000)
  assert.equal(f.frames.size, 1)
  f.send(f.window, 'keydown', { code: 'ArrowUp' })
  f.advance(60_000)
  assert.equal(f.frames.size, 0)
  f.send(f.window, 'keyup', { code: 'ArrowUp' })
  f.advance(29_999)
  assert.equal(f.frames.size, 0)
  f.advance(1)
  assert.equal(f.frames.size, 1)
})

test('hidden, offscreen, reduced-motion and modal states stop rotation; disposal removes pending work', t => {
  const f = fixture(t)
  f.observer.callback([{ isIntersecting: false }])
  assert.equal(f.frames.size, 0)
  f.observer.callback([{ isIntersecting: true }])
  assert.equal(f.frames.size, 1)
  f.document.hidden = true
  f.send(f.document, 'visibilitychange')
  f.advance(60_000)
  assert.equal(f.frames.size, 0)
  f.document.hidden = false
  f.send(f.document, 'visibilitychange')
  f.advance(30_000)
  assert.equal(f.frames.size, 1)
  f.motion.matches = true
  f.send(f.motion, 'change')
  f.advance(60_000)
  assert.equal(f.frames.size, 0)
  f.motion.matches = false
  f.send(f.motion, 'change')
  f.advance(30_000)
  assert.equal(f.frames.size, 1)
  f.send(f.document, 'document-viewer:open')
  f.advance(60_000)
  assert.equal(f.frames.size, 0)
  f.send(f.document, 'document-viewer:close')
  f.rotation.dispose()
  f.advance(60_000)
  assert.equal(f.frames.size, 0)
  assert.equal(f.timers.size, 0)
  assert.equal(f.observer.disconnected, true)
  f.send(f.host, 'pointerleave')
  assert.equal(f.timers.size, 0)
})
