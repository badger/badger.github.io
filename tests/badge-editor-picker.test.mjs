import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/badge-editor-picker.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })
const { initProjectPicker } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
const flush = () => new Promise(resolve => setImmediate(resolve))
for (const key of ['window', 'document', 'ImageData', 'Worker', 'IntersectionObserver']) Object.defineProperty(globalThis, key, { value: undefined, writable: true, configurable: true })

function environment(t) {
  class Element extends EventTarget {
    constructor(tag = '') { super(); this.tag = tag; this.children = []; this.dataset = {}; this.style = {}; this.value = ''; this.textContent = ''; this.open = false }
    append(...items) { this.children.push(...items) }
    replaceChildren() { this.children = [] }
    setAttribute() {}
    showModal() { this.open = true }
    close() { this.open = false; this.dispatchEvent(new Event('close')) }
    click() { this.dispatchEvent(new Event('click')) }
    getContext() { return { putImageData() {} } }
    querySelectorAll() { return tabs }
  }
  const tabs = ['apps', 'examples', 'badge'].map(collection => { const tab = new Element('button'); tab.dataset.collection = collection; return tab })
  const elements = new Map()
  const element = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id) }
  const timers = new Map()
  let next = 0
  const workers = []
  t.mock.property(globalThis, 'document', Object.assign(new EventTarget(), { hidden: false, getElementById: element, createElement: tag => new Element(tag) }))
  t.mock.property(globalThis, 'window', { setTimeout: (callback, delay) => { timers.set(++next, { callback, delay }); return next } })
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id))
  t.mock.property(globalThis, 'ImageData', class {})
  t.mock.property(globalThis, 'IntersectionObserver', class { observe() {} disconnect() {} })
  t.mock.property(globalThis, 'Worker', class {
    constructor() { workers.push(this); this.terminated = false; this.messages = [] }
    postMessage(data) { this.messages.push(data) }
    terminate() { this.terminated = true }
    emit(data) { this.onmessage?.({ data }) }
  })
  t.mock.method(globalThis, 'fetch', async () => new Response('print("hello")'))
  const picker = initProjectPicker(async () => {}, () => {})
  t.after(() => picker.dispose())
  picker.setApps({ revision: 'test', apps: [{ name: 'badge', title: 'Badge', files: ['__init__.py'] }] })
  element('browse-apps').click()
  const card = () => element('picker-gallery').children[0]?.children[1].children[0]
  return { picker, workers, timers, element, card, expire(delay) { for (const [id, timer] of timers) if (timer.delay === delay) { timers.delete(id); timer.callback() } } }
}

test('a ready preview without a frame terminates after the render deadline', async t => {
  const env = environment(t)
  env.card().children[0].click()
  await flush()
  const worker = env.workers[0]
  worker.emit({ ready: true })
  assert.equal(worker.messages.length, 1)
  assert.deepEqual([...env.timers.values()].map(timer => timer.delay), [6000])
  env.expire(6000)
  assert.equal(worker.terminated, true)
  assert.equal(env.card().children[0].children[2].textContent, 'Preview unavailable')
  assert.match(env.element('picker-status').textContent, /Could not preview Badge/)
})

test('the first frame cancels the startup deadline and closing terminates playback', async t => {
  const env = environment(t)
  env.card().children[0].click()
  await flush()
  const worker = env.workers[0]
  worker.emit({ ready: true })
  worker.emit({ frame: { width: 1, height: 1, buffer: new Uint8Array(4).buffer } })
  assert.equal(env.timers.size, 0)
  env.expire(6000)
  assert.equal(worker.terminated, false)
  assert.equal(env.card().children[0].children[2].textContent, 'Playing')
  env.element('project-picker').close()
  assert.equal(worker.terminated, true)
})

test('approved app descriptions are displayed and searchable with a plain Edit label', t => {
  const env = environment(t)
  assert.equal(env.card().children[1].children[0].children[1].textContent, 'Display your GitHub profile and contribution graph.')
  assert.equal(env.card().children[1].children[1].textContent, 'Edit')
  env.element('picker-search').value = 'contribution'
  env.element('picker-search').dispatchEvent(new Event('input'))
  assert.ok(env.card())
  env.element('picker-search').value = 'no match'
  env.element('picker-search').dispatchEvent(new Event('input'))
  assert.equal(env.card(), undefined)
})

test('example cards display readable titles while retaining filename searches', t => {
  const env = environment(t)
  env.picker.setExamples({ revision: 'test', categories: [{ name: 'Text', examples: [{ file: 'vector_text.py', description: 'Render vector text', assets: [] }, { file: 'lighten_darken.py', description: 'Adjust colors', assets: [] }] }] })
  env.element('browse-examples').click()
  const cards = env.element('picker-gallery').children[0].children[1].children
  assert.deepEqual(cards.map(card => card.children[1].children[0].children[0].textContent), ['Vector Text', 'Lighten Darken'])
  for (const query of ['vector text', 'vector_text.py']) {
    env.element('picker-search').value = query
    env.element('picker-search').dispatchEvent(new Event('input'))
    assert.equal(env.card().children[1].children[0].children[0].textContent, 'Vector Text')
  }
})
