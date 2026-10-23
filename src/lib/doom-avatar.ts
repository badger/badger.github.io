import { DOOM_SHAREWARE_WAD, verifyArtifact } from './doom-assets'
import { isDoomGameplay, type createDoomPowerMode } from './doom-party-marty'
import { sitePath } from './site-path'

export function githubUsername(value: string) {
  return /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/i.test(value) ? value.toLowerCase() : null
}

export class DoomUsernameInput {
  value: string | null = null
  reset() { this.value = null }
  key(key: string): { captured: boolean; username?: string } {
    if (this.value === null) {
      if (key !== '@') return { captured: false }
      this.value = ''
    }
    else if (key === 'Escape') this.reset()
    else if (key === 'Enter') {
      const username = this.value
      this.reset()
      return { captured: true, username }
    } else if (key === 'Backspace') this.value = this.value.slice(0, -1)
    else if (key.length === 1) this.value = (this.value + key).slice(0, 256)
    return { captured: true }
  }
}

export function doomPalette(wad: Uint8Array) {
  const view = new DataView(wad.buffer, wad.byteOffset, wad.byteLength)
  if (wad.length < 12 || String.fromCharCode(...wad.subarray(0, 4)) !== 'IWAD') throw new Error('Invalid Doom WAD')
  const count = view.getUint32(4, true)
  const directory = view.getUint32(8, true)
  if (directory + count * 16 > wad.length) throw new Error('Invalid Doom WAD directory')
  for (let index = 0; index < count; index++) {
    const entry = directory + index * 16
    if (String.fromCharCode(...wad.subarray(entry + 8, entry + 16)).replace(/\0/g, '') !== 'PLAYPAL') continue
    const start = view.getUint32(entry, true)
    if (view.getUint32(entry + 4, true) < 768 || start + 768 > wad.length) break
    return wad.slice(start, start + 768)
  }
  throw new Error('Doom WAD palette is missing')
}

export function palettePixels(pixels: Uint8ClampedArray, palette: Uint8Array) {
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = pixels[offset + 3] / 255
    const rgb = [0, 1, 2].map(channel => pixels[offset + channel] * alpha + 47 * (1 - alpha))
    let nearest = 0
    let distance = Infinity
    for (let color = 0; color < 768; color += 3) {
      const delta = rgb.reduce((sum, value, channel) => sum + (value - palette[color + channel]) ** 2, 0)
      if (delta < distance) { distance = delta; nearest = color }
    }
    pixels.set(palette.subarray(nearest, nearest + 3), offset)
    pixels[offset + 3] = 255
  }
}

function loadImage(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.referrerPolicy = 'no-referrer'
    const finish = (error?: unknown) => {
      image.onload = image.onerror = null
      signal.removeEventListener('abort', aborted)
      if (error) reject(error)
      else resolve(image)
    }
    const aborted = () => { finish(signal.reason); image.src = '' }
    image.onload = () => finish()
    image.onerror = () => finish(new Error('GitHub avatar could not be loaded'))
    signal.addEventListener('abort', aborted, { once: true })
    if (signal.aborted) aborted()
    else image.src = url
  })
}

export function createDoomAvatar(
  root: HTMLElement,
  signal: AbortSignal,
  powerMode: ReturnType<typeof createDoomPowerMode>,
  releaseInput: () => void,
  onActivate = () => {},
) {
  if (globalThis.location?.search && location.pathname.endsWith('/')) {
    const url = new URL(location.href)
    url.pathname = url.pathname.replace(/\/$/, '') || '/'
    history.replaceState(history.state, '', url)
  }
  const input = new DoomUsernameInput()
  let face: HTMLCanvasElement | undefined
  let palette: Promise<Uint8Array> | undefined
  let request: AbortController | undefined
  let paused = false
  let gameplay = false
  let powered = false
  const updateURL = (username: string | null, fromURL = false) => {
    const url = new URL(location.href)
    if (username) url.searchParams.set('u', username)
    else url.searchParams.delete('u')
    if (url.search) url.pathname = url.pathname.replace(/\/$/, '') || '/'
    history.replaceState(history.state, '', url)
    document.dispatchEvent(new CustomEvent('doom:avatar-change', { detail: { fromURL } }))
  }
  async function select(value: string, fromURL = false) {
    const username = githubUsername(value)
    if (!username) return false
    powerMode.activate()
    powered = true
    request?.abort()
    const current = new AbortController()
    request = current
    const loading = AbortSignal.any([signal, current.signal, AbortSignal.timeout(15000)])
    try {
      palette ??= (async () => {
        const response = await fetch(sitePath('/doom/DOOM1.WAD'), {
          signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        })
        if (!response.ok) throw new Error('Doom palette unavailable')
        const wad = await response.arrayBuffer()
        await verifyArtifact(wad, DOOM_SHAREWARE_WAD)
        return doomPalette(new Uint8Array(wad))
      })().catch(error => { palette = undefined; throw error })
      const avatar = (async () => {
        try { return await loadImage(`https://github.com/${username}.png?size=128`, loading) }
        catch (error) {
          loading.throwIfAborted()
          // GitHub's redirect can lack CORS headers; its avatar CDN permits canvas reads.
          return loadImage(`https://avatars.githubusercontent.com/${username}?s=128`, loading)
        }
      })()
      const [image, colors] = await Promise.all([avatar, palette])
      loading.throwIfAborted()
      const next = document.createElement('canvas')
      next.width = 35
      next.height = 31
      const context = next.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Avatar canvas unavailable')
      const side = Math.min(image.naturalWidth, image.naturalHeight)
      context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 35, 31)
      const pixels = context.getImageData(0, 0, 35, 31)
      palettePixels(pixels.data, colors)
      context.putImageData(pixels, 0, 0)
      onActivate()
      face = next
      updateURL(username, fromURL)
      modelUsername(username)
      return true
    } catch (error) {
      if (signal.aborted || current.signal.aborted) return false
      console.warn(`Could not load GitHub avatar @${username}.`, error)
      return false
    }
  }
  function modelUsername(username: string | null) {
    const host = root.querySelector<HTMLElement>('[data-doom-model]')
    if (host) {
      if (username) host.dataset.avatar = username
      else delete host.dataset.avatar
    }
  }
  function clear() {
    request?.abort()
    face = undefined
    input.reset()
    modelUsername(null)
    if (globalThis.location) updateURL(null)
  }
  const keyboard = (event: KeyboardEvent) => {
    const target = event.target instanceof Element ? event.target : null
    if (!gameplay || paused || event.isComposing || event.ctrlKey || event.altKey || event.metaKey ||
      target?.closest('input, textarea, select, [contenteditable], [role="textbox"]')) return
    if (event.type !== 'keydown') {
      if (input.value !== null || capturedKeys.has(event.code)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (event.type === 'keyup') capturedKeys.delete(event.code)
      }
      return
    }
    if (event.repeat && event.key !== 'Backspace' && (input.value !== null || capturedKeys.has(event.code))) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    const result = input.key(event.key)
    if (!result.captured) return
    capturedKeys.add(event.code)
    event.preventDefault()
    event.stopImmediatePropagation()
    releaseInput()
    if (result.username !== undefined) void select(result.username)
  }
  const capturedKeys = new Set<string>()
  for (const type of ['keydown', 'keypress', 'keyup']) root.addEventListener(type, keyboard as EventListener, { signal, capture: true })
  window.addEventListener('blur', () => {
    input.reset()
    capturedKeys.clear()
  }, { signal })
  const initial = new URLSearchParams(globalThis.location?.search).get('u')
  if (initial !== null) void select(initial, true)
  return {
    clear,
    select,
    visible() { return gameplay && !!face },
    render(context: CanvasRenderingContext2D) {
      gameplay = !paused && isDoomGameplay(context)
      if (!gameplay) {
        input.reset()
        capturedKeys.clear()
        return
      }
      if (!powered) return
      powerMode.render(true)
      if (!face) return
      const smoothing = context.imageSmoothingEnabled
      context.imageSmoothingEnabled = false
      context.drawImage(face, 143, 169, 35, 31)
      context.imageSmoothingEnabled = smoothing
    },
    setPaused(value: boolean) { paused = value; if (value) { gameplay = false; input.reset(); capturedKeys.clear() } },
    dispose() { request?.abort(); face = undefined },
  }
}
