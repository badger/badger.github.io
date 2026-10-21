import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Worker } from 'node:worker_threads'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/badge-editor-project.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })
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

test('raycast minimap clearing resets every RGBA channel in the real simulator', async () => {
  const source = await readFile(new URL('../public/editor-examples/raycast.py', import.meta.url), 'utf8')
  const setup = source.match(/^minimap_overlay = image\([^\n]+\)\nminimap_overlay_mv = [^\n]+\nminimap_overlay_len = [^\n]+/m)[0]
  const clear = source.match(/^def clear\(buf, length\):\n(?:  [^\n]+\n)+/m)[0]
  const result = await run(request(`
MAP_SIZE_X = 3
MAP_SIZE_Y = 2
minimap_scale = 1
${setup}
${clear}
for index in range(len(minimap_overlay_mv)):
    minimap_overlay_mv[index] = 255
clear(minimap_overlay_mv, minimap_overlay_len)
assert len(minimap_overlay_mv) == MAP_SIZE_X * MAP_SIZE_Y * 4
assert all(value == 0 for value in minimap_overlay_mv)
print('Minimap cleared')
`))
  assert.equal(result.error, '')
  assert.match(result.output.join('\n'), /Minimap cleared/)
})

test('shared firmware API runs in MicroPython with separate button and gamepad input and rotation state', async () => {
  const result = await run(request(`
from badgeware import get_backlight, set_backlight
import brand, hints, missing_details
from pairing import Pairing
from badgeware import link
badge.poll()
assert badge.buttons.held(BUTTON_SELECT)
assert not badge.buttons.held(BUTTON_LEFT)
# Upside down, the display rotates and the left pad reads as right.
assert badge.pad.held(BUTTON_RIGHT) and not badge.pad.held(BUTTON_LEFT)
assert not badge.pad.held(BUTTON_SELECT)
assert badge.all.held(BUTTON_RIGHT) and badge.all.held(BUTTON_SELECT)
assert badge.pressed(BUTTON_RIGHT)
assert badge.pad.direction().x == 1
assert badge.buttons.direction().x == 0
badge.poll()
assert not badge.pressed()
assert badge.autorotate()
assert badge.upside_down() and badge.rotate_180()
assert badge.imu() == (0, 16384, 0, 0, 0, 0)
badge.autorotate(False)
badge.rotate_180(False)
assert not badge.rotate_180() and badge.upside_down()
badge.autorotate(True)
assert badge.rotate_180()
import js
js.set_test_buttons(0)
badge.poll()
assert badge.pad.released(BUTTON_RIGHT)
assert badge.buttons.released(BUTTON_SELECT)
assert badge.changed(BUTTON_RIGHT)
assert not badge.held()
assert not badge.rotate_180() and not badge.upside_down()
assert badge.imu() == (0, -16384, 0, 0, 0, 0)
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

test('browser network, motion, and touch pad shims behave like the badge firmware', async () => {
  const result = await run(request(`
import requests, urequests, wifi, network, ntptime, fetch, secrets, os
from requests import get
assert wifi.connect(timeout=5, retries=2) and wifi.is_connected() and not wifi.failure()
assert wifi.status()[0] >= 0
assert network.WLAN(network.STA_IF).isconnected() and network.WLAN(network.STA_IF).ifconfig()[0] != "0.0.0.0"
ntptime.settime()
assert secrets.WIFI_SSID
response = get("https://api.test/data", headers={"X-Test": "1"})
assert response.status_code == 200 and response.ok
assert response.json()["method"] == "GET" and response.json()["headers"]["X-Test"] == "1"
assert response.headers["x-test"] == "yes"
posted = urequests.post("https://api.test/data", json={"a": 1}).json()
assert posted["method"] == "POST" and posted["body"] == '{"a": 1}'
assert requests.get("https://api.test/missing", timeout=1).status_code == 404
try:
    requests.get("https://api.test/offline")
    raise AssertionError("expected OSError")
except OSError:
    pass
fetch.AsyncFetch.MAX_HEADER_BYTES = 8192
download = fetch.url("https://api.test/file").to("/download.tmp")
assert not download and download.state == "Fetching via browser"
assert download and download.error is None
assert open("/download.tmp").read() == "file body"
failed = fetch.url("https://api.test/missing").to("/missing.tmp")
assert not failed and not failed and failed.error == "HTTP 404"
assert badge.imu() == (100, -200, -16000, 1, 2, 3)
assert BUTTON_BACK != BUTTON_HOME and BUTTON_MENU != BUTTON_HOME and BUTTON_BACK != BUTTON_MENU
badge.poll()
assert badge.pressed(BUTTON_BACK) and not badge.pressed(BUTTON_HOME)
import bluetooth
from badgeware import link
assert not bluetooth.BLE().active() and bluetooth.UUID("a") == bluetooth.UUID("a")
target = image(20, 20)
link.draw_identicon(target, b"12345678", 0, 0, 10, color.white, color.black)
assert not link.Link("test").central and link.Proximity(None).sync_id is None
import powman, machine, js
class Rebooted(Exception):
    pass
def reboot():
    raise Rebooted()
machine.reset = reboot
js.set_test_buttons(32)
try:
    powman.reset_into_msc()
    raise AssertionError("expected reset")
except Rebooted:
    pass
print('Browser shims passed')
`), {
    input: 8192,
    motion: [100, -200, -16000, 1, 2, 3],
    http: { 'https://api.test/data': {}, 'https://api.test/missing': { status: 404, body: 'missing' }, 'https://api.test/file': { body: 'file body' } },
  })
  assert.equal(result.error, '')
  assert.match(result.output.join('\n'), /Browser shims passed/)
})

test('bundled app entry points render with their full projects in the real simulator', async t => {
  const catalog = JSON.parse(await readFile(new URL('../public/editor-apps/catalog.json', import.meta.url), 'utf8'))
  // These apps need badge networking or firmware I/O that the simulator does not provide.
  const hardwareOnly = { camera: /no module named 'socket'/, Copilot: /no module named 'socket'/, system: /no module named 'badgeware\.io'/ }
  // These apps stop with a simulator limitation message instead of running.
  const simulatorLimited = { show: /Sparkle shows not supported in the simulator/ }
  for (const app of catalog.apps) {
    await t.test(app.name, async () => {
      const files = await Promise.all(app.files.map(async path => projectFile(path, new Uint8Array(await readFile(new URL(`../public/editor-apps/${app.name}/${path}`, import.meta.url))))))
      const result = await run(simulationRequest({ name: app.name, sourceName: app.name, files }))
      if (hardwareOnly[app.name]) {
        assert.match(result.error, hardwareOnly[app.name])
        return
      }
      if (simulatorLimited[app.name]) {
        assert.match(result.output.join('\n'), simulatorLimited[app.name])
        return
      }
      assert.ok(result.frames > 0, `${result.error}\n${result.output.join('\n')}`)
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

test('shipping firmware shared assets and helper APIs are available in the real simulator', async () => {
  const result = await run(request(`
import missing_details, wifi
for path in ('skull.png', 'icons.png', 'cards.png', 'tufty.png', 'background.png', 'sparkle/invertocat.png', 'squirrel-sprites/running.png'):
    assert image.load('/system/assets/' + path)
assert font.load('/system/assets/fonts/lato-400.af') and font.load('/system/assets/fonts/lato-900.af')
assert not wifi.failure() and wifi.is_connected()
missing_details.show([], lambda: None, ('your name, GitHub username,', 'and LinkedIn stub'))
missing_details.show(['WIFI_SSID'], lambda: None)
badge.update()
print('Shipping firmware passed')
`))
  assert.equal(result.error, '')
  assert.match(result.output.join('\n'), /Shipping firmware passed/)
})

test('Sparkle light shows report the simulator limitation', async () => {
  const result = await run(request('import sparkle\nsparkle.request_local_show()\n'))
  assert.match(result.output.join('\n'), /Sparkle shows not supported in the simulator/)
})
