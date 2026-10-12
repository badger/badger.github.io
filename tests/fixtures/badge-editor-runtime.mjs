import { parentPort, workerData } from 'node:worker_threads'
import { readFile } from 'node:fs/promises'
import { loadMicroPython } from '../../public/simulator/asyncify/micropython.mjs'

const { request, input = 0, frameLimit = 8 } = workerData
let inputMask = input
const output = []
let frames = 0
let rotation = false
let runtime
globalThis.WorkerGlobalScope = { worker: { running: true, paused: false, stopping: false } }
globalThis.sim_buttons = () => inputMask
globalThis.set_test_buttons = value => { inputMask = value }
globalThis.sim_display_rotation = value => { rotation = value }
globalThis.backlight = () => {}
globalThis.sim_pwm_set = () => {}
globalThis.blitrgba = () => {
  frames++
  if (frames >= frameLimit) runtime.interrupt()
}
globalThis.fetch = async () => { throw new Error('Network access is unavailable in runtime tests') }
runtime = await loadMicroPython({ heapsize: 7 * 1024 * 1024, stdout: value => output.push(value), stderr: value => output.push(value) })
const manifest = JSON.parse(await readFile(new URL('../../public/simulator/filesystem.json', import.meta.url), 'utf8'))

function stage(name, content) {
  let directory = ''
  for (const part of name.split('/').slice(1, -1)) {
    directory += '/' + part
    try { runtime.FS.mkdir(directory) } catch {}
  }
  runtime.FS.writeFile(name, content)
}

for (const name of Object.keys(manifest.files)) stage(name, new Uint8Array(await readFile(new URL(`../../public/simulator/filesystem${name}`, import.meta.url))))
for (const file of request.files) stage(file.name, file.content)
await runtime.runPython('import sys; sys.path.insert(0, "/"); import badgeware')
const timer = setTimeout(() => runtime.interrupt(), 3000)
let error = ''
try { await runtime.runPython(request.program) } catch (failure) { error = String(failure) }
clearTimeout(timer)
if (request.inspect) {
  try { await runtime.runPython(request.inspect) } catch (failure) { error += String(failure) }
}
parentPort.postMessage({ frames, rotation, output, error })
