import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { build } from 'esbuild'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/doom-pro-tip.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { initDoomProTip } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

function setup(t, search = '') {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const original = { hidden: false }
  const avatar = { hidden: true }
  const discovery = { hidden: false }
  const change = { hidden: true }
  const location = { search }
  const document = new EventTarget()
  const window = new EventTarget()
  const previous = new Map()
  for (const [key, value] of Object.entries({ document, window, location })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const root = {
    hidden: false,
    querySelector: selector => ({
      '[data-doom-tip-default]': original,
      '[data-doom-tip-avatar]': avatar,
      '[data-doom-tip-discovery]': discovery,
      '[data-doom-tip-change]': change,
    })[selector],
  }
  const dispose = initDoomProTip(root)
  t.after(() => {
    dispose()
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  return { root, original, avatar, discovery, change, location, document, window, dispose }
}

test('original cheat tip is replaced by avatar discovery after ten seconds', t => {
  const { original, avatar, discovery, change } = setup(t)
  assert.equal(original.hidden, false)
  assert.equal(avatar.hidden, true)
  t.mock.timers.tick(9_999)
  assert.equal(original.hidden, false)
  assert.equal(avatar.hidden, true)
  t.mock.timers.tick(1)
  assert.equal(original.hidden, true)
  assert.equal(avatar.hidden, false)
  assert.equal(discovery.hidden, false)
  assert.equal(change.hidden, true)
})

test('existing usernames get the change-avatar tip after the delay and URL changes keep it consistent', t => {
  const { original, avatar, discovery, change, location, document, window } = setup(t, '?u=leereilly')
  assert.equal(original.hidden, false)
  assert.equal(avatar.hidden, true)
  t.mock.timers.tick(10_000)
  assert.equal(original.hidden, true)
  assert.equal(avatar.hidden, false)
  assert.equal(discovery.hidden, true)
  assert.equal(change.hidden, false)
  location.search = ''
  document.dispatchEvent(new Event('doom:avatar-change'))
  assert.equal(discovery.hidden, false)
  assert.equal(change.hidden, true)
  location.search = '?u=octocat'
  window.dispatchEvent(new Event('popstate'))
  assert.equal(discovery.hidden, true)
  assert.equal(change.hidden, false)
  location.search = ''
  document.dispatchEvent(new Event('doom:avatar-change'))
  assert.equal(discovery.hidden, false)
  assert.equal(original.hidden, true)
})

test('leaving the page cancels the timer and removes avatar-change listeners', t => {
  const { original, avatar, discovery, location, document, window } = setup(t)
  window.dispatchEvent(new Event('pagehide'))
  t.mock.timers.tick(10_000)
  location.search = '?u=octocat'
  document.dispatchEvent(new Event('doom:avatar-change'))
  assert.equal(original.hidden, false)
  assert.equal(avatar.hidden, true)
  assert.equal(discovery.hidden, false)
})

test('typing a username hides the entire tip before or after the delay', t => {
  const { root, location, document, window, change } = setup(t)
  location.search = '?u=octocat'
  document.dispatchEvent(new CustomEvent('doom:avatar-change', { detail: { fromURL: false } }))
  assert.equal(root.hidden, true)
  t.mock.timers.tick(10_000)
  assert.equal(root.hidden, true)
  document.dispatchEvent(new CustomEvent('doom:avatar-change', { detail: { fromURL: false } }))
  assert.equal(root.hidden, true)
  window.dispatchEvent(new Event('popstate'))
  assert.equal(root.hidden, false)
  assert.equal(change.hidden, false)
})

test('loading a URL avatar keeps the tip until a username is entered in-game', t => {
  const { root, change, location, document } = setup(t, '?u=octocat')
  document.dispatchEvent(new CustomEvent('doom:avatar-change', { detail: { fromURL: true } }))
  t.mock.timers.tick(10_000)
  assert.equal(root.hidden, false)
  assert.equal(change.hidden, false)
  document.dispatchEvent(new CustomEvent('doom:avatar-change', { detail: { fromURL: false } }))
  assert.equal(root.hidden, true)
  location.search = ''
  document.dispatchEvent(new CustomEvent('doom:avatar-change', { detail: { fromURL: false } }))
  assert.equal(root.hidden, false)
})
