import { BadgeInput, initBadgeKeyboard } from './badge-editor-input'
import { createBadgeModelController } from './badge-editor-model-controller'
import { initBadgeMotion } from './badge-motion'
import { loadBadgeOs } from './badge-os-simulator'

const bootTimeout = 20000
const frameTimeout = 10000

function supportsSimulator() {
  if (typeof Worker !== 'function' || typeof WebAssembly !== 'object' || typeof ImageData !== 'function') return false
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    return false
  }
  let moduleWorkers = false
  try {
    const probe = new Worker(URL.createObjectURL(new Blob([''], { type: 'text/javascript' })), { get type() { moduleWorkers = true; return 'module' as const } })
    probe.terminate()
  } catch {
    return false
  }
  return moduleWorkers
}

export function initBadgeOsSimulator(root: HTMLElement) {
  const host = root.querySelector<HTMLElement>('[data-model]')!
  const simulator = root.querySelector<HTMLElement>('[data-simulator]')!
  const screen = root.querySelector<HTMLCanvasElement>('[data-screen]')!
  const status = root.querySelector<HTMLElement>('[data-status]')!
  const controls = {
    reset: root.querySelector<HTMLButtonElement>('[data-model-reset]')!,
    screen: root.querySelector<HTMLButtonElement>('[data-model-screen]')!,
    status: root.querySelector<HTMLElement>('[data-model-status]')!,
    zoomIn: root.querySelector<HTMLButtonElement>('[data-model-zoom-in]') ?? undefined,
    zoomOut: root.querySelector<HTMLButtonElement>('[data-model-zoom-out]') ?? undefined,
  }
  const keys = [...root.querySelectorAll<HTMLButtonElement>('[data-button]')]
  if (!supportsSimulator()) return

  const controller = new AbortController()
  const { signal } = controller
  let worker: Worker | null = null
  let timer = 0
  let visible = false
  let failed = false
  let framed = false
  let modelReady = false

  const fail = (reason: unknown) => {
    if (failed) return
    failed = true
    console.warn('Badge simulator unavailable; showing the badge photo instead.', reason)
    clearTimeout(timer)
    worker?.terminate()
    worker = null
    controller.abort()
    model.dispose()
    root.dataset.state = 'fallback'
  }

  const model = createBadgeModelController(async (modelSignal, modelFail) => {
    const { initBadgeModel } = await import('./badge-editor-model')
    if (modelSignal.aborted) throw new Error('3D loading cancelled.')
    const view = initBadgeModel(host, screen, (bit, pressed) => input.set('model', bit, pressed), modelSignal, modelFail, controls)
    void view.ready.then(() => { modelReady = true; reveal() }, () => {})
    return view
  }, fail)

  const input = new BadgeInput(mask => {
    worker?.postMessage({ buttons: mask })
    for (const key of keys) key.dataset.pressed = String((mask & Number(key.dataset.button)) !== 0)
    model.setButtons(mask)
  })
  const removeKeyboard = initBadgeKeyboard(simulator, input)
  signal.addEventListener('abort', removeKeyboard)
  initBadgeMotion(root, motion => worker?.postMessage({ motion }), signal)

  function reveal() {
    if (failed || !framed || !modelReady || root.dataset.state === 'running') return
    root.dataset.state = 'running'
    status.textContent = 'Running Mona OS 4.0'
  }

  const pause = () => worker?.postMessage({ pause: document.hidden || !visible })
  const watchdog = (ms: number, reason: string) => {
    clearTimeout(timer)
    timer = window.setTimeout(() => fail(new Error(reason)), ms)
  }

  async function boot() {
    root.dataset.state = 'loading'
    model.start()
    try {
      const request = await loadBadgeOs()
      if (failed) return
      const next = new Worker('/simulator/micropython.worker.js', { type: 'module' })
      worker = next
      watchdog(bootTimeout, 'Simulator boot timed out')
      next.onerror = event => { event.preventDefault(); fail(event.message || 'Worker error') }
      next.onmessageerror = () => fail('Worker message error')
      const output: string[] = []
      next.onmessage = ({ data }) => {
        if (typeof data.stdout === 'string' && output.push(data.stdout) > 20) output.shift()
        if (data.failed) {
          // The worker reports the Python error on stdout just after this message.
          window.setTimeout(() => fail(new Error(output.join('\n') || 'Simulator program failed')), 250)
          return
        }
        if (data.bootError || data.stuck || data.completed) return fail(data.bootError || 'Simulator stopped')
        if (data.ready) {
          watchdog(frameTimeout, 'No display output')
          next.postMessage({ ...request, debug: false })
          pause()
        }
        if (data.frame) {
          const { width, height, buffer } = data.frame
          if (screen.width !== width || screen.height !== height) {
            screen.width = width
            screen.height = height
          }
          screen.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(buffer), width, height), 0, 0)
          model.updateFrame()
          if (!framed) {
            framed = true
            clearTimeout(timer)
            reveal()
          }
        }
        if (data.backlight !== undefined) model.setBacklight(Math.max(0.15, Math.min(1, data.backlight)))
      }
    } catch (error) {
      fail(error)
    }
  }

  for (const key of keys) {
    const bit = Number(key.dataset.button)
    const release = () => input.set(`pointer:${bit}`, bit, false)
    key.addEventListener('pointerdown', event => {
      if (event.button !== 0) return
      key.setPointerCapture(event.pointerId)
      input.set(`pointer:${bit}`, bit, true)
    }, { signal })
    key.addEventListener('pointerup', release, { signal })
    key.addEventListener('pointercancel', release, { signal })
    key.addEventListener('lostpointercapture', release, { signal })
    key.addEventListener('contextmenu', event => event.preventDefault(), { signal })
  }
  document.addEventListener('visibilitychange', () => { input.clear(); pause() }, { signal })
  window.addEventListener('pagehide', event => { if (!event.persisted) { worker?.terminate(); model.dispose() } }, { signal })

  let started = false
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible && !started) {
      started = true
      void boot()
    }
    if (!visible) input.clear()
    pause()
  })
  observer.observe(root)
  signal.addEventListener('abort', () => observer.disconnect())
}
