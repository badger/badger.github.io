import { githubUsername } from './doom-avatar'

export function selfiePNG(image: HTMLCanvasElement, background: string): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Image export is unavailable in this browser.'))
  context.fillStyle = background
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode the image. Try again.')), 'image/png')
  })
}

export function initDoomSelfie(root: HTMLElement, capture: () => HTMLCanvasElement, signal: AbortSignal) {
  const panel = root.querySelector<HTMLElement>('[data-doom-selfie]')
  const save = root.querySelector<HTMLButtonElement>('[data-doom-selfie-save]')
  const status = root.querySelector<HTMLElement>('[data-doom-selfie-status]')
  let ready = false
  let busy = false
  let username: string | null = null
  const downloads = new Map<string, ReturnType<typeof setTimeout>>()
  const sync = () => { if (save) save.disabled = !ready || !username || busy }
  const syncVisibility = () => {
    username = githubUsername(new URLSearchParams(globalThis.location?.search).get('u') ?? '')
    if (panel) panel.hidden = !username
    if (save) save.hidden = !username
    sync()
  }
  syncVisibility()
  document.addEventListener('doom:avatar-change', syncVisibility, { signal })
  window.addEventListener('popstate', syncVisibility, { signal })
  save?.addEventListener('click', async () => {
    if (!ready || !username || busy || !status) return
    busy = true
    sync()
    status.textContent = 'Preparing image...'
    try {
      const image = capture()
      const blob = await selfiePNG(image, getComputedStyle(document.body).backgroundColor)
      if (signal.aborted) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'doom-badge-selfie.png'
      root.append(link)
      link.click()
      link.remove()
      downloads.set(url, setTimeout(() => {
        URL.revokeObjectURL(url)
        downloads.delete(url)
      }, 30_000))
      status.textContent = 'Image saved: 1200 × 630 PNG'
    } catch (error) {
      if (!signal.aborted && status) status.textContent = error instanceof Error ? error.message : 'Could not save the image. Try again.'
    } finally {
      busy = false
      sync()
    }
  }, { signal })
  signal.addEventListener('abort', () => {
    for (const [url, timer] of downloads) {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
    }
    downloads.clear()
  }, { once: true })
  return {
    setReady(value: boolean) {
      if (ready === value) return
      ready = value
      sync()
      if (!busy && status) status.textContent = ready
        ? ''
        : 'Wait for the 3D badge to load. Close videos or installation help to save.'
    },
  }
}
