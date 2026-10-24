import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { build } from 'esbuild'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/doom-selfie.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { selfiePNG, initDoomSelfie } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
)

function setup(t, search = '?u=octocat') {
  const save = Object.assign(new EventTarget(), { disabled: true })
  const panel = { hidden: true }
  const status = { textContent: '' }
  const calls = []
  const blob = new Blob(['png'], { type: 'image/png' })
  const context = {
    fillRect: (...args) => calls.push(['background', ...args]),
    drawImage: (...args) => calls.push(['image', ...args]),
  }
  const canvas = {
    getContext: () => context,
    toBlob: (callback, type) => { calls.push(['encode', type]); callback(blob) },
  }
  const link = { click() { calls.push(['download', this.download, this.href]) }, remove() {} }
  const root = {
    querySelector: selector => ({
      '[data-doom-selfie-save]': save,
      '[data-doom-selfie-status]': status,
      '[data-doom-selfie]': panel,
    })[selector],
    append() {},
  }
  const previous = new Map()
  const document = Object.assign(new EventTarget(), { body: {}, createElement: tag => tag === 'canvas' ? canvas : link })
  const window = new EventTarget()
  const location = { search }
  for (const [name, value] of Object.entries({
    document, window, location,
    getComputedStyle: () => ({ backgroundColor: 'rgb(242, 245, 243)' }),
  })) {
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
  return { save, panel, status, calls, blob, context, canvas, root, abort, document, window, location }
}

test('selfie stays hidden without a valid username and follows avatar and URL changes', t => {
  const { root, panel, save, abort, document, window, location } = setup(t, '')
  const selfie = initDoomSelfie(root, () => ({}), abort.signal)
  assert.equal(panel.hidden, true)
  assert.equal(save.hidden, true)
  selfie.setReady(true)
  assert.equal(save.disabled, true)
  location.search = '?u=octocat'
  document.dispatchEvent(new Event('doom:avatar-change'))
  assert.equal(panel.hidden, false)
  assert.equal(save.hidden, false)
  assert.equal(save.disabled, false)
  selfie.setReady(true)
  location.search = ''
  document.dispatchEvent(new Event('doom:avatar-change'))
  assert.equal(panel.hidden, true)
  assert.equal(save.hidden, true)
  assert.equal(save.disabled, true)
  location.search = '?u=../invalid'
  window.dispatchEvent(new Event('popstate'))
  assert.equal(panel.hidden, true)
  location.search = '?u=leereilly'
  window.dispatchEvent(new Event('popstate'))
  assert.equal(panel.hidden, false)
  assert.equal(save.disabled, false)
})

test('a valid username in the initial URL reveals the selfie without an entry form', t => {
  const { root, panel, abort } = setup(t)
  initDoomSelfie(root, () => ({}), abort.signal)
  assert.equal(panel.hidden, false)
})

test('selfie PNG composites the badge at 1200 by 630 using the current theme background', async t => {
  const { canvas, context, calls, blob } = setup(t)
  const image = {}
  assert.equal(await selfiePNG(image, 'rgb(242, 245, 243)'), blob)
  assert.equal(canvas.width, 1200)
  assert.equal(canvas.height, 630)
  assert.equal(context.fillStyle, 'rgb(242, 245, 243)')
  assert.deepEqual(calls, [
    ['background', 0, 0, 1200, 630],
    ['image', image, 0, 0, 1200, 630],
    ['encode', 'image/png'],
  ])
  canvas.toBlob = callback => callback(null)
  await assert.rejects(selfiePNG(image, 'black'), /Could not encode/)
})

test('save requires a ready 3D view, downloads a PNG, and handles export failure with retry', async t => {
  const { root, save, status, calls, abort } = setup(t)
  let captures = 0
  let failed = false
  const selfie = initDoomSelfie(root, () => {
    captures++
    if (failed) throw new Error('The 3D badge is unavailable. Reload to try again.')
    return {}
  }, abort.signal)
  save.dispatchEvent(new Event('click'))
  assert.equal(captures, 0)
  selfie.setReady(true)
  assert.equal(save.disabled, false)
  save.dispatchEvent(new Event('click'))
  assert.equal(save.disabled, true)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(captures, 1)
  assert.equal(save.disabled, false)
  assert.match(status.textContent, /1200 × 630 PNG/)
  assert.equal(calls.find(call => call[0] === 'download')[1], 'doom-badge-selfie.png')
  selfie.setReady(false)
  assert.equal(save.disabled, true)
  selfie.setReady(true)
  failed = true
  save.dispatchEvent(new Event('click'))
  await new Promise(resolve => setImmediate(resolve))
  assert.match(status.textContent, /Reload to try again/)
  assert.equal(save.disabled, false)
})

test('aborting during image encoding prevents a download', async t => {
  const { root, save, calls, canvas, blob, abort } = setup(t)
  let finish
  canvas.toBlob = callback => { finish = callback }
  const selfie = initDoomSelfie(root, () => ({}), abort.signal)
  selfie.setReady(true)
  save.dispatchEvent(new Event('click'))
  abort.abort()
  finish(blob)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls.some(call => call[0] === 'download'), false)
})
