import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Worker } from 'node:worker_threads'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/badge-os-simulator.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })
const { badgeOsRequest } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
const { projectFile } = await import(`data:text/javascript;base64,${Buffer.from((await build({ entryPoints: [fileURLToPath(new URL('../src/lib/badge-editor-project.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })).outputFiles[0].text).toString('base64')}`)

const catalog = JSON.parse(await readFile(new URL('../public/editor-apps/catalog.json', import.meta.url), 'utf8'))

async function loadApp(app) {
  const files = await Promise.all(app.files.map(async path => projectFile(path, new Uint8Array(await readFile(new URL(`../public/editor-apps/${app.name}/${path}`, import.meta.url))))))
  return { name: app.name, files }
}

function run(request) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./fixtures/badge-editor-runtime.mjs', import.meta.url), { workerData: { request, frameLimit: 400, timeLimit: 15000 } })
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Simulator exceeded its runtime test limit')) }, 20000)
    worker.once('message', result => { clearTimeout(timer); worker.terminate(); resolve(result) })
    worker.once('error', error => { clearTimeout(timer); worker.terminate(); reject(error) })
  })
}

test('catalog bundles the launcher menu separately from installable apps', () => {
  assert.equal(catalog.launcher.name, 'menu')
  assert.ok(catalog.launcher.files.includes('__init__.py'))
  assert.ok(!catalog.apps.some(app => app.name === 'menu'))
})

test('BadgeOS launcher lists stock apps, launches the selection, and returns to the menu on HOME', async () => {
  const menu = await loadApp(catalog.launcher)
  const apps = await Promise.all(catalog.apps.map(loadApp))
  // Scripted input: idle in the menu, move right, select, run the app, then press HOME.
  const prelude = `
import builtins, js
_script_polls = 0
_script_poll = badge.poll
_script_launch = launch
def _scripted_poll():
    global _script_polls
    _script_polls += 1
    js.set_test_buttons({12: 512, 20: 1024, 60: 32, 80: 32}.get(_script_polls, 0))
    _script_poll()
def _logged_launch(path):
    print("LAUNCH", path)
    if path == "/system/apps/menu" and _script_polls > 60:
        print("Returned home")
        raise KeyboardInterrupt()
    return _script_launch(path)
badge.poll = _scripted_poll
builtins.launch = _logged_launch
import os
print("APPS", sorted(os.listdir("/system/apps")))
`
  const result = await run(badgeOsRequest(menu, apps, prelude))
  const output = result.output.join('\n')
  assert.match(output, /APPS .*'menu'/)
  for (const app of catalog.apps) assert.match(output, new RegExp(`'${app.name}'`))
  assert.match(output, /LAUNCH \/system\/apps\/menu\nLAUNCH \/system\/apps\/badge\nLAUNCH \/system\/apps\/menu\nReturned home/)
  assert.doesNotMatch(output, /- ERROR:|Traceback/)
  assert.match(result.error, /KeyboardInterrupt/)
  assert.ok(result.frames > 20)
})
