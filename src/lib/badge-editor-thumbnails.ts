import { simulationRequest, type EditorProject } from './badge-editor-project'
import { sitePath } from './site-path'

type Thumbnail = { width: number; height: number; pixels: Uint8ClampedArray }
type Card = { key: string; canvas: HTMLCanvasElement; cover: HTMLElement; label: HTMLElement; load: () => Promise<EditorProject> }

export function initThumbnails(root: HTMLElement) {
  const cache = new Map<string, Thumbnail>()
  const cards = new Map<Element, Card>()
  const queue: Card[] = []
  let observer: IntersectionObserver | null = null
  let worker: Worker | null = null
  let generation = 0
  let draining = false
  let finish: (() => void) | null = null

  function paint(card: Card, frame: Thumbnail) {
    if (card.canvas.dataset.live === 'true') return
    card.canvas.width = frame.width
    card.canvas.height = frame.height
    card.canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(frame.pixels), frame.width, frame.height), 0, 0)
    card.cover.hidden = true
    card.label.textContent = 'Play preview'
  }

  async function drain() {
    if (draining || document.hidden) return
    draining = true
    const current = generation
    while (queue.length && current === generation && !document.hidden) {
      const card = queue.shift()!
      try {
        const project = await card.load()
        if (current !== generation) break
        if (document.hidden) { queue.unshift(card); break }
        await new Promise<void>(resolve => {
          const active = new Worker(sitePath('/simulator/micropython.worker.js'), { type: 'module' })
          worker = active
          let latest: Thumbnail | null = null
          let rendered: Thumbnail | null = null
          let frames = 0
          let settle: number | undefined
          let timeout: number | undefined
          const done = () => {
            clearTimeout(timeout)
            clearTimeout(settle)
            active.terminate()
            if (worker === active) worker = null
            if (finish === done) finish = null
            if (current === generation) {
              const frame = rendered || latest
              if (frame) { cache.set(card.key, frame); paint(card, frame) }
              else { card.cover.textContent = 'Preview unavailable'; card.label.textContent = 'Try preview' }
            }
            resolve()
          }
          finish = done
          timeout = window.setTimeout(done, 30000)
          active.onerror = event => { event.preventDefault(); done() }
          active.onmessageerror = done
          active.onmessage = ({ data }) => {
            if (worker !== active || current !== generation) return
            if (data.bootError || data.failed) return done()
            if (data.ready) {
              clearTimeout(timeout)
              timeout = window.setTimeout(done, 6000)
              try { active.postMessage({ ...simulationRequest(project), debug: false }) } catch { done() }
            }
            if (data.frame) {
              latest = { width: data.frame.width, height: data.frame.height, pixels: new Uint8ClampedArray(data.frame.buffer) }
              const pixels = latest.pixels
              for (let i = 4; i < pixels.length; i += 4) {
                if (pixels[i] === pixels[0] && pixels[i + 1] === pixels[1] && pixels[i + 2] === pixels[2]) continue
                rendered = latest
                if (++frames >= 6) done()
                else if (!settle) settle = window.setTimeout(done, 250)
                break
              }
            }
            if (data.completed) done()
          }
        })
      } catch {
        if (current === generation) { card.cover.textContent = 'Preview unavailable'; card.label.textContent = 'Try preview' }
      }
    }
    if (current === generation) draining = false
  }

  function reset() {
    generation++
    observer?.disconnect()
    observer = null
    cards.clear()
    queue.length = 0
    finish?.()
    worker?.terminate()
    worker = null
    draining = false
  }

  const visibility = () => {
    worker?.postMessage({ pause: document.hidden })
    if (!document.hidden) void drain()
  }
  document.addEventListener('visibilitychange', visibility)

  return {
    reset,
    add(card: Card) {
      const cached = cache.get(card.key)
      if (cached) { paint(card, cached); return }
      cards.set(card.canvas, card)
      observer ??= new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const pending = cards.get(entry.target)
          if (pending) { queue.push(pending); cards.delete(entry.target); observer?.unobserve(entry.target) }
        }
        void drain()
      }, { root, rootMargin: '200px' })
      observer.observe(card.canvas)
    },
    invalidateBadge() { for (const key of cache.keys()) if (key.startsWith('badge/')) cache.delete(key) },
    dispose() { reset(); cache.clear(); document.removeEventListener('visibilitychange', visibility) },
  }
}
