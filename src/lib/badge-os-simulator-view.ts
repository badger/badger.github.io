import { BadgeInput, initBadgeKeyboard } from './badge-editor-input'
import { loadBadgeOs } from './badge-os-simulator'

const bootTimeout = 20000
const frameTimeout = 10000

function supportsSimulator() {
  if (typeof Worker !== 'function' || typeof WebAssembly !== 'object' || typeof ImageData !== 'function') return false
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
  const fallback = root.querySelector<HTMLElement>('[data-fallback]')!
  const simulator = root.querySelector<HTMLElement>('[data-simulator]')!
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!
  const status = root.querySelector<HTMLElement>('[data-status]')!
  const keys = [...root.querySelectorAll<HTMLButtonElement>('[data-button]')]
  if (!supportsSimulator()) return

  const controller = new AbortController()
  const { signal } = controller
  let worker: Worker | null = null
  let timer = 0
  let visible = false
  let failed = false

  const input = new BadgeInput(mask => {
    worker?.postMessage({ buttons: mask })
    for (const key of keys) key.dataset.pressed = String((mask & Number(key.dataset.button)) !== 0)
  })
  const removeKeyboard = initBadgeKeyboard(simulator, input)
  signal.addEventListener('abort', removeKeyboard)

  const fail = (reason: unknown) => {
    if (failed) return
    failed = true
    console.warn('Badge simulator unavailable; showing the badge photo instead.', reason)
    clearTimeout(timer)
    worker?.terminate()
    worker = null
    controller.abort()
    simulator.hidden = true
    fallback.hidden = false
    root.dataset.state = 'fallback'
  }

  const pause = () => worker?.postMessage({ pause: document.hidden || !visible })
  const watchdog = (ms: number, reason: string) => {
    clearTimeout(timer)
    timer = window.setTimeout(() => fail(new Error(reason)), ms)
  }

  async function boot() {
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
          clearTimeout(timer)
          const { width, height, buffer } = data.frame
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
          }
          canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(buffer), width, height), 0, 0)
          if (root.dataset.state !== 'running') {
            root.dataset.state = 'running'
            fallback.hidden = true
            simulator.hidden = false
            status.textContent = 'Running BadgeOS'
          }
        }
        if (data.backlight !== undefined) canvas.style.opacity = String(Math.max(0.15, Math.min(1, data.backlight)))
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
  canvas.addEventListener('pointerdown', () => canvas.focus(), { signal })
  document.addEventListener('visibilitychange', () => { input.clear(); pause() }, { signal })

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
