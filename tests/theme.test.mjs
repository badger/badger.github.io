import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/theme.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { setTheme, getActiveTheme } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
const layout = await readFile(new URL('../src/layouts/Layout.astro', import.meta.url), 'utf8')
const script = layout.match(/<script is:inline>([\s\S]*?)<\/script>/)[1]

function fixture(t, saved) {
  const classes = new Set(['dark'])
  const window = new EventTarget()
  const document = { documentElement: { classList: {
    contains: name => classes.has(name),
    replace(from, to) { if (classes.delete(from)) classes.add(to) },
    toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name) },
  } } }
  const localStorage = {
    getItem: () => saved,
    setItem(_key, value) { saved = value },
  }
  const globals = { document, window, localStorage, CustomEvent }
  const previous = new Map()
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  t.after(() => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  const run = () => runInNewContext(script, {
    ...globals,
    addEventListener: window.addEventListener.bind(window),
    dispatchEvent: window.dispatchEvent.bind(window),
  })
  return { classes, document, window, localStorage, run }
}

test('dark HTML works without JavaScript and saved light preference applies before paint', t => {
  assert.match(layout, /<html lang="en" class="dark">/)
  const f = fixture(t, 'light')
  f.run()
  assert.deepEqual([...f.classes], ['light'])
  assert.equal(getActiveTheme(), 'light')
  const themes = []
  f.window.addEventListener('badger-theme-change', event => themes.push(event.detail))
  setTheme('dark')
  assert.equal(f.localStorage.getItem('badger-theme'), 'dark')
  assert.deepEqual([...f.classes], ['dark'])
  assert.deepEqual(themes, ['dark'])
})

test('cached pages resync saved preferences and blocked storage does not break the theme', t => {
  const f = fixture(t)
  f.run()
  assert.deepEqual([...f.classes], ['dark'])
  const themes = []
  f.window.addEventListener('badger-theme-change', event => themes.push(event.detail))
  f.localStorage.setItem('badger-theme', 'light')
  f.window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }))
  assert.deepEqual([...f.classes], ['light'])
  assert.deepEqual(themes, ['light'])
  f.localStorage.setItem = () => { throw new Error('Storage blocked') }
  setTheme('dark')
  assert.deepEqual([...f.classes], ['dark'])
  f.localStorage.getItem = () => { throw new Error('Storage blocked') }
  assert.doesNotThrow(f.run)
  assert.deepEqual([...f.classes], ['dark'])
})
