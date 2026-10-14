import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: [new URL('../src/lib/badge-editor-thumbnails.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', write: false })
const { initThumbnails } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
const project = { name: 'demo', sourceName: 'demo', files: [{ path: '__init__.py', text: 'print("demo")', data: new Uint8Array() }] }
const flush = () => new Promise(resolve => setImmediate(resolve))
for (const key of ['window', 'document', 'ImageData', 'Worker', 'IntersectionObserver']) Object.defineProperty(globalThis, key, { value: undefined, writable: true, configurable: true })

function environment(t) {
  const workers = []
  const observers = []
  const listeners = new Map()
  t.mock.property(globalThis, 'window', { setTimeout: globalThis.setTimeout })
  t.mock.property(globalThis, 'document', { hidden: false, addEventListener: (type, listener) => listeners.set(type, listener), removeEventListener: type => listeners.delete(type) })
  t.mock.property(globalThis, 'ImageData', class { constructor(pixels, width, height) { Object.assign(this, { pixels, width, height }) } })
  t.mock.property(globalThis, 'Worker', class {
    constructor() { workers.push(this); this.messages = []; this.terminated = false }
    postMessage(data) { this.messages.push(data) }
    terminate() { this.terminated = true }
    emit(data) { this.onmessage?.({ data }) }
  })
  t.mock.property(globalThis, 'IntersectionObserver', class {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this) }
    observe(target) { this.targets.push(target) }
    unobserve() {}
    disconnect() {}
    reveal() { this.callback(this.targets.map(target => ({ target, isIntersecting: true }))) }
  })
  function card(key, load = async () => structuredClone(project)) {
    const painted = []
    return { key, load, painted, canvas: { dataset: {}, getContext: () => ({ putImageData: data => painted.push(data) }) }, cover: { hidden: false, textContent: '' }, label: { textContent: '' } }
  }
  return { workers, observers, card, visibility: () => listeners.get('visibilitychange')?.() }
}

test('visible cards render sequentially, cache real frames, and cancel workers on close', async t => {
  const env = environment(t)
  const engine = initThumbnails({})
  t.after(() => engine.dispose())
  const first = env.card('one')
  const second = env.card('two')
  engine.add(first)
  engine.add(second)
  env.observers[0].reveal()
  await flush()
  assert.equal(env.workers.length, 1)
  env.workers[0].emit({ ready: true })
  assert.equal(env.workers[0].messages[0].files[0].name, '/system/apps/demo/__init__.py')
  env.workers[0].emit({ frame: { width: 2, height: 1, buffer: new Uint8Array([20, 80, 40, 255, 20, 80, 40, 255]).buffer } })
  assert.equal(first.cover.hidden, false)
  assert.equal(env.workers[0].terminated, false)
  for (let i = 0; i < 6; i++) env.workers[0].emit({ frame: { width: 2, height: 1, buffer: new Uint8Array([20, 80, 40, 255, 40, 100, 60, 255]).buffer } })
  await flush()
  assert.equal(env.workers[0].terminated, true)
  assert.equal(first.cover.hidden, true)
  assert.deepEqual(first.painted[0].pixels, new Uint8ClampedArray([20, 80, 40, 255, 40, 100, 60, 255]))
  assert.equal(env.workers.length, 2)
  engine.reset()
  assert.equal(env.workers[1].terminated, true)
  env.workers[1].emit({ frame: { width: 1, height: 1, buffer: new Uint8Array(4).buffer } })
  assert.equal(second.painted.length, 0)
  const cached = env.card('one')
  engine.add(cached)
  assert.equal(cached.cover.hidden, true)
  assert.equal(env.workers.length, 2)
})

test('closing during a project load prevents a stale worker from starting', async t => {
  const env = environment(t)
  const engine = initThumbnails({})
  t.after(() => engine.dispose())
  let resolve
  const delayed = new Promise(done => { resolve = done })
  const card = env.card('delayed', () => delayed)
  engine.add(card)
  env.observers[0].reveal()
  engine.reset()
  resolve(project)
  await flush()
  assert.equal(env.workers.length, 0)
  assert.equal(card.painted.length, 0)
})

test('hiding during project loading requeues the card until the tab is visible', async t => {
  const env = environment(t)
  const engine = initThumbnails({})
  t.after(() => engine.dispose())
  let resolve
  const delayed = new Promise(done => { resolve = done })
  const card = env.card('delayed', () => delayed)
  engine.add(card)
  env.observers[0].reveal()
  document.hidden = true
  env.visibility()
  resolve(project)
  await flush()
  assert.equal(env.workers.length, 0)
  document.hidden = false
  env.visibility()
  await flush()
  assert.equal(env.workers.length, 1)
  env.workers[0].emit({ ready: true })
  env.workers[0].emit({ frame: { width: 1, height: 1, buffer: new Uint8Array([20, 80, 40, 255]).buffer } })
  env.workers[0].emit({ completed: true })
  await flush()
  assert.equal(card.cover.hidden, true)
  assert.equal(env.workers[0].terminated, true)
})
