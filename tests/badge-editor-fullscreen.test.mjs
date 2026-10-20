import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/badge-editor-fullscreen.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })
const { initEditorFullscreen } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
Object.defineProperty(globalThis, 'document', { value: undefined, writable: true, configurable: true })

function environment(t) {
  const listeners = []
  let dialog = false
  let home = 0
  const workspace = { dataset: {}, querySelector: () => dialog ? {} : null }
  const button = Object.assign(new EventTarget(), { setAttribute() {}, focus() {} })
  const doc = {
    body: { style: { overflow: 'auto' } },
    getElementById: id => id === 'badge-editor' ? workspace : button,
    addEventListener: (type, callback, capture) => listeners.push({ type, callback, capture }),
    removeEventListener(type, callback, capture) { const index = listeners.findIndex(listener => listener.type === type && listener.callback === callback && listener.capture === capture); if (index >= 0) listeners.splice(index, 1) },
  }
  t.mock.property(globalThis, 'document', doc)
  const dispose = initEditorFullscreen(() => {})
  t.after(dispose)
  function escape() {
    const event = new Event('keydown', { cancelable: true })
    Object.defineProperty(event, 'key', { value: 'Escape' })
    for (const listener of listeners.filter(listener => listener.type === 'keydown' && listener.capture)) listener.callback(event)
    if (!event.cancelBubble) home++
    for (const listener of listeners.filter(listener => listener.type === 'keydown' && !listener.capture)) if (!event.cancelBubble) listener.callback(event)
    return event
  }
  return { button, workspace, doc, listeners, dispose, escape, get home() { return home }, set dialog(value) { dialog = value } }
}

test('Escape exits fallback fullscreen before simulator Home receives the key', async t => {
  const env = environment(t)
  env.button.dispatchEvent(new Event('click'))
  assert.equal(env.workspace.dataset.fullscreen, 'true')
  const event = env.escape()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(event.defaultPrevented, true)
  assert.equal(env.home, 0)
  assert.equal(env.workspace.dataset.fullscreen, 'false')
  assert.equal(env.doc.body.style.overflow, 'auto')
  env.dispose()
  assert.equal(env.listeners.length, 0)
})

test('Escape leaves open dialog handling and normal simulator controls available', t => {
  const env = environment(t)
  assert.equal(env.escape().defaultPrevented, false)
  assert.equal(env.home, 1)
  env.button.dispatchEvent(new Event('click'))
  env.dialog = true
  assert.equal(env.escape().defaultPrevented, false)
  assert.equal(env.workspace.dataset.fullscreen, 'true')
})
