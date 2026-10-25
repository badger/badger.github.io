import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { setImmediate as tick } from 'node:timers/promises'

const compiled = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/badge-editor-model-controller.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })
const { createBadgeModelController } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

function model(overrides = {}) {
  return { ready: Promise.resolve(), updateFrame() {}, setButtons() {}, setBacklight() {}, dispose() {}, ...overrides }
}

test('unsupported graphics and missing model imports do not escape into the editor', async () => {
  for (const load of [() => { throw new Error('WebGL unavailable') }, () => Promise.reject(new Error('Module unavailable'))]) {
    const errors = []
    const controller = createBadgeModelController(load, error => errors.push(error.message))
    controller.start()
    await tick()
    assert.equal(errors.length, 1)
    assert.doesNotThrow(() => { controller.updateFrame(); controller.setButtons(16); controller.setBacklight(1); controller.dispose() })
  }
})

test('a stalled import times out, aborts loading and disposes a late model', async () => {
  let finish
  let signal
  let disposed = 0
  const errors = []
  const controller = createBadgeModelController(value => {
    signal = value
    return new Promise(resolve => finish = resolve)
  }, error => errors.push(error.message), 10)
  controller.start()
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(signal.aborted, true)
  assert.equal(errors.length, 1)
  finish(model({ dispose() { disposed++ } }))
  await tick()
  assert.equal(disposed, 1)
  controller.dispose()
})

test('model download or parsing rejection switches to fallback and releases resources', async () => {
  let reject
  let disposed = 0
  const errors = []
  const controller = createBadgeModelController(async () => model({
    ready: new Promise((_, fail) => reject = fail),
    dispose() { disposed++ },
  }), error => errors.push(error.message))
  controller.start()
  await tick()
  reject(new Error('HTTP 404'))
  await tick()
  assert.deepEqual(errors, ['HTTP 404'])
  assert.equal(disposed, 1)
})

test('frame, button and backlight errors cannot interrupt simulator callbacks, even if cleanup throws', async () => {
  for (const method of ['updateFrame', 'setButtons', 'setBacklight']) {
    let broken = false
    const errors = []
    const controller = createBadgeModelController(async () => model({
      [method]() { if (broken) throw new Error(method) },
      dispose() { throw new Error('cleanup failed') },
    }), error => errors.push(error.message))
    controller.start()
    await tick()
    broken = true
    assert.doesNotThrow(() => controller[method](16))
    assert.deepEqual(errors, [method])
    assert.doesNotThrow(() => { controller[method](16); controller.dispose() })
  }
})

test('asynchronous graphics errors switch to fallback once and release the view', async () => {
  let fail
  let disposed = 0
  const errors = []
  const controller = createBadgeModelController(async (_, report) => {
    fail = report
    return model({ dispose() { disposed++ } })
  }, error => errors.push(error.message))
  controller.start()
  await tick()
  fail(new Error('Context lost'))
  fail(new Error('Later frame'))
  assert.deepEqual(errors, ['Context lost'])
  assert.equal(disposed, 1)
})

test('input and backlight changes during loading reach the new model', async () => {
  let finish
  const states = []
  const controller = createBadgeModelController(() => new Promise(resolve => finish = resolve), () => assert.fail('Unexpected fallback'))
  controller.start()
  controller.setButtons(20)
  controller.setBacklight(0.5)
  await tick()
  finish(model({ setButtons(value) { states.push(['buttons', value]) }, setBacklight(value) { states.push(['backlight', value]) } }))
  await tick()
  assert.deepEqual(states, [['buttons', 20], ['backlight', 0.5]])
  controller.dispose()
})

test('display orientation changes during loading reach the new model', async () => {
  let finish
  const states = []
  const controller = createBadgeModelController(() => new Promise(resolve => finish = resolve), () => assert.fail('Unexpected fallback'))
  controller.start()
  controller.setDisplayRotated(true)
  await tick()
  finish(model({ setDisplayRotated(value) { states.push(value) } }))
  await tick()
  assert.deepEqual(states, [true])
  controller.dispose()
})

test('image capture forwards dimensions and remains unavailable before load or after disposal', async () => {
  const image = {}
  const calls = []
  const controller = createBadgeModelController(async () => model({
    capture(...dimensions) { calls.push(dimensions); return image },
  }), () => assert.fail('Unexpected fallback'))
  assert.throws(() => controller.capture(1200, 630), /unavailable/)
  controller.start()
  await tick()
  assert.equal(controller.capture(1200, 630), image)
  assert.deepEqual(calls, [[1200, 630]])
  controller.dispose()
  assert.throws(() => controller.capture(1200, 630), /unavailable/)
})
