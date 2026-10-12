import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Worker } from 'node:worker_threads'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: [new URL('../src/lib/badge-editor-project.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', write: false })
const { simulationRequest, projectFile, loadSimulatorExample } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

function run(request, options = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./fixtures/badge-editor-runtime.mjs', import.meta.url), { workerData: { request, ...options } })
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Simulator exceeded its runtime test limit')) }, 6000)
    worker.once('message', result => { clearTimeout(timer); worker.terminate(); resolve(result) })
    worker.once('error', error => { clearTimeout(timer); worker.terminate(); reject(error) })
  })
}

function request(source, name = 'runtime-contract') {
  return simulationRequest({ name, sourceName: name, files: [projectFile('__init__.py', new TextEncoder().encode(source))] })
}

test('shared firmware API runs in MicroPython with separate button and gamepad input and rotation state', async () => {
  const result = await run(request(`
from badgeware import get_backlight, set_backlight
import brand, hints, missing_details
from pairing import Pairing
from badgeware import link
badge.poll()
assert badge.buttons.held(BUTTON_SELECT)
assert not badge.buttons.held(BUTTON_LEFT)
assert badge.pad.held(BUTTON_LEFT)
assert not badge.pad.held(BUTTON_SELECT)
assert badge.all.held(BUTTON_LEFT) and badge.all.held(BUTTON_SELECT)
assert badge.pressed(BUTTON_LEFT)
assert badge.pad.direction().x == -1
assert badge.buttons.direction().x == 0
badge.poll()
assert not badge.pressed()
assert badge.autorotate()
assert badge.upside_down() and badge.rotate_180()
assert badge.imu()[2] == -16384
badge.autorotate(False)
badge.rotate_180(False)
assert not badge.rotate_180() and badge.upside_down()
badge.autorotate(True)
assert badge.rotate_180()
import js
js.set_test_buttons(0)
badge.poll()
assert badge.pad.released(BUTTON_LEFT)
assert badge.buttons.released(BUTTON_SELECT)
assert badge.changed(BUTTON_LEFT)
assert not badge.held()
assert not badge.rotate_180() and not badge.upside_down()
badge.poll()
assert not badge.released()
set_backlight(0.4)
assert get_backlight() == 0.4
assert brand.LIGHT_GREY and brand.GREY_0 and brand.ORANGE_2
assert missing_details.mona_sans()
assert missing_details.missing('GITHUB_USERNAME') == ['GITHUB_USERNAME']
assert link.ID_LEN and not link.Link('test').send(b'test')
badge.pad.set_state((BUTTON_RIGHT,), (BUTTON_RIGHT,), (), (BUTTON_RIGHT,))
assert badge.pad.direction().x == 1
print('Firmware contract passed')
`), { input: 4 | 256 | 32768 })
  assert.equal(result.error, '')
  assert.match(result.output.join('\n'), /Firmware contract passed/)
  assert.equal(result.rotation, false)
})

test('bundled app entry points render with their full projects in the real simulator', async t => {
  const catalog = JSON.parse(await readFile(new URL('../public/editor-apps/catalog.json', import.meta.url), 'utf8'))
  for (const app of catalog.apps) {
    await t.test(app.name, async () => {
      const files = await Promise.all(app.files.map(async path => projectFile(path, new Uint8Array(await readFile(new URL(`../public/editor-apps/${app.name}/${path}`, import.meta.url))))))
      const result = await run(simulationRequest({ name: app.name, sourceName: app.name, files }))
      assert.ok(result.frames > 0, `${result.error}\n${result.output.join('\n')}`)
      if (app.name === 'mass_storage') {
        assert.match(result.output.join('\n'), /MSC not supported in the simulator/)
        return
      }
      assert.doesNotMatch(result.output.join('\n'), /- ERROR:|Traceback/)
      assert.ok(!result.error || result.error.includes('KeyboardInterrupt'), result.error)
    })
  }
})

test('all simulator examples execute their packaged code and assets', async t => {
  const catalog = JSON.parse(await readFile(new URL('../public/editor-examples/catalog.json', import.meta.url), 'utf8'))
  t.mock.method(globalThis, 'fetch', async path => new Response(await readFile(new URL(`../public${path}`, import.meta.url))))
  for (const category of catalog.categories) for (const example of category.examples) {
    await t.test(example.file, async () => {
      const project = await loadSimulatorExample(example)
      const result = await run(simulationRequest(project))
      assert.ok(result.frames > 0, `${result.error}\n${result.output.join('\n')}`)
      assert.doesNotMatch(result.output.join('\n'), /- ERROR:|Traceback/)
      assert.ok(!result.error || result.error.includes('KeyboardInterrupt'), result.error)
    })
  }
})

test('native and Viper functions execute a simulation fallback without changing upload bytes', async () => {
  const source = `
import micropython
@micropython.viper
def copy(source, target, count: int):
    src = ptr32(source)
    dst = ptr32(target)
    for index in range(count):
        dst[index] = src[index]
@micropython.native
def total(values):
    return sum(values)
source = bytearray(b'\\x01\\x02\\x03\\x04\\x05\\x06\\x07\\x08')
target = bytearray(8)
copy(source, target, 2)
assert target == source
assert total([1, 2, 3]) == 6
ptr8(target)[0] = 7
ptr16(target)[1] = 65535
assert target[0] == 7 and target[2] == 255 and target[3] == 255
print('Native fallback passed')
`
  const file = projectFile('__init__.py', new TextEncoder().encode(source))
  const result = await run(simulationRequest({ name: 'native-test', sourceName: 'native-test', files: [file] }))
  assert.equal(result.error, '')
  assert.match(result.output.join('\n'), /Native fallback passed/)
  assert.equal(file.text, source)
  assert.equal(new TextDecoder().decode(file.data), source)
})

test('current firmware icon fonts load by name and render in the real simulator', async () => {
  const result = await run(request(`
families = ('cosmetics', 'emoji', 'food', 'hats', 'tools_crafting', 'travel', 'weather')
badge.mode(HIRES)
screen.pen = color.rgb(0, 0, 0)
screen.clear()
screen.pen = color.rgb(255, 255, 255)
for index, family in enumerate(families):
    for variant in (family, family + '_outline'):
        screen.font = getattr(font, variant)
        screen.text('!', 8 + index * 32, 16 if variant == family else 64, 2)
assert font.load('badgeware') and font.load('badgewaremax')
badge.update()
print('Firmware fonts passed')
`))
  assert.equal(result.error, '')
  assert.equal(result.frames, 1)
  assert.match(result.output.join('\n'), /Firmware fonts passed/)
})
