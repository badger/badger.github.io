import { BadgeInput, initBadgeKeyboard } from './badge-editor-input'
import { createBadgeModelController } from './badge-editor-model-controller'
import { initBadgeMotion } from './badge-motion'
import { loadBadgeOs } from './badge-os-simulator'
import { sitePath } from './site-path'

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
    screen: root.querySelector<HTMLButtonElement>('[data-model-screen]')!,
    full: root.querySelector<HTMLButtonElement>('[data-model-full]') ?? undefined,
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

  let rotated = false
  let buttons = 0
  // Bit 32768 tells the firmware the badge is upside down, so it autorotates
  // the display and swaps the touch pad directions.
  const sendButtons = () => worker?.postMessage({ buttons: buttons | (rotated ? 32768 : 0) })
  const input = new BadgeInput(mask => {
    buttons = mask
    sendButtons()
    for (const key of keys) key.dataset.pressed = String((mask & Number(key.dataset.button)) !== 0)
    model.setButtons(mask)
  })
  const removeKeyboard = initBadgeKeyboard(simulator, input)
  signal.addEventListener('abort', removeKeyboard)
  const motion = initBadgeMotion(root, value => worker?.postMessage({ motion: value }), signal)
  const rotateButton = root.querySelector<HTMLButtonElement>('[data-model-rotate]')!
  rotateButton.addEventListener('click', () => {
    rotated = !rotated
    rotateButton.setAttribute('aria-pressed', String(rotated))
    model.setRotated(rotated)
    motion.setFlipped(rotated)
    sendButtons()
  }, { signal })

  function reveal() {
    if (failed || !framed || !modelReady || root.dataset.state === 'running') return
    root.dataset.state = 'running'
    status.textContent = 'Running Mona OS 4.0'
  }

  // The first-frame watchdog only runs while the simulator is unpaused, so
  // scrolling away or hiding the tab before the first frame is not a failure.
  let awaitingFrame = false
  const pause = () => {
    const paused = document.hidden || !visible
    worker?.postMessage({ pause: paused })
    if (!awaitingFrame) return
    if (paused) clearTimeout(timer)
    else watchdog(frameTimeout, 'No display output')
  }
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
      const next = new Worker(sitePath('/simulator/micropython.worker.js'), { type: 'module' })
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
          awaitingFrame = true
          next.postMessage({ ...request, debug: false })
          sendButtons()
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
            awaitingFrame = false
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
    // Enter and Space hold the button like a pointer. Preventing their default
    // suppresses the keyboard click, so a click with no pointer detail comes
    // from assistive technology and taps the button once.
    const keyRelease = () => input.set(`key:${bit}`, bit, false)
    key.addEventListener('keydown', event => {
      if (event.key !== ' ' && event.key !== 'Enter') return
      event.preventDefault()
      input.set(`key:${bit}`, bit, true)
    }, { signal })
    key.addEventListener('keyup', event => {
      if (event.key !== ' ' && event.key !== 'Enter') return
      event.preventDefault()
      keyRelease()
    }, { signal })
    key.addEventListener('blur', keyRelease, { signal })
    key.addEventListener('click', event => {
      if (event.detail !== 0) return
      input.set(`click:${bit}`, bit, true)
      window.setTimeout(() => input.set(`click:${bit}`, bit, false), 150)
    }, { signal })
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
