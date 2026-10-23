import { sitePath } from './site-path'
import { dispatchDoomCharacter } from './doom-input'

// STBAR border samples from the bundled Doom 1 shareware WAD, outside changing HUD fields.
const hudSamples = [
  [0, 168, 151], [0, 188, 139],
  [4, 196, 87], [20, 199, 47], [30, 198, 79], [70, 199, 35],
  [100, 199, 71], [130, 199, 47], [180, 199, 59], [210, 199, 47],
  [250, 199, 47], [280, 199, 27], [315, 171, 67], [319, 180, 39],
  [318, 188, 67], [315, 196, 55],
]

export function hasDoomHud(context: CanvasRenderingContext2D) {
  const { data } = context.getImageData(0, 168, 320, 32)
  const levels = hudSamples.map(([x, y]) => data[((y - 168) * 320 + x) * 4 + 1])
  const low = Math.min(...levels)
  const range = Math.max(...levels) - low
  if (range < 20) return false
  // Normalize palette flashes and gamma without treating the title screen as a HUD.
  return levels.filter((level, index) => Math.abs((level - low) / range - (hudSamples[index][2] - 27) / 124) < 0.12).length >= 14
}

// Both bundled M_SKULL cursor frames share these opaque green-channel samples.
const menuSamples = [
  [11, 2, 163], [13, 6, 0], [9, 8, 15], [2, 8, 111], [17, 8, 111],
  [5, 9, 131], [14, 9, 123], [7, 12, 115], [12, 12, 115],
  [9, 14, 131], [10, 14, 131], [8, 16, 0], [14, 16, 43],
]

export function isDoomGameplay(context: CanvasRenderingContext2D) {
  if (!hasDoomHud(context)) return false
  const { data } = context.getImageData(0, 0, 320, 200)
  for (let y = 0; y <= 181; y++) {
    for (let x = 0; x <= 300; x++) {
      const offset = (y * 320 + x) * 4 + 1
      const low = data[offset + (6 * 320 + 7) * 4]
      const range = data[offset + (2 * 320 + 8) * 4] - low
      if (!(range >= 40)) continue
      let menu = true
      for (const [dx, dy, level] of menuSamples) {
        if (!(Math.abs((data[offset + (dy * 320 + dx) * 4] - low) / range - level / 163) <= 0.08)) {
          menu = false
          break
        }
      }
      if (menu) return false
    }
  }
  return true
}

export function createDoomPowerMode() {
  let active = false
  let started = false
  let pending = ''
  let nextKey = 0
  let nextRefill = 0
  return {
    activate() { active = true },
    render(hud: boolean, now = performance.now()) {
      if (!active || !hud) return
      if (hud && !started) {
        started = true
        pending = 'iddqdidkfa'
        nextRefill = now + 5000
      }
      if (started && !pending && now >= nextRefill) {
        pending = 'idkfa'
        nextRefill = now + 5000
      }
      if (pending && now >= nextKey) {
        const letter = pending[0]
        pending = pending.slice(1)
        dispatchDoomCharacter(letter, 'keydown')
        dispatchDoomCharacter(letter, 'keypress')
        dispatchDoomCharacter(letter, 'keyup')
        nextKey = now + 50
      }
    },
  }
}

export function createPartyMarty(
  root: HTMLElement,
  video: HTMLVideoElement,
  signal: AbortSignal,
  reportError: (message: string) => void,
  powerMode = createDoomPowerMode(),
  onActivate = () => {},
) {
  let buffer = ''
  let active = false
  let faceEnabled = true
  let paused = false
  let failed = false
  const fail = (error: unknown) => {
    if (failed || signal.aborted) return
    failed = true
    video.pause()
    console.warn('Party Marty video could not be played.', error)
    reportError('Party Marty video unavailable. Doom cheats remain active.')
  }
  const play = () => {
    if (active && faceEnabled && !paused && !failed) void video.play().catch(fail)
  }
  root.addEventListener('keydown', event => {
    const target = event.target instanceof Element ? event.target : null
    if (paused || event.repeat || event.isComposing) return
    if (event.ctrlKey || event.altKey || event.metaKey || target?.closest('input, textarea, select, [contenteditable], [role="textbox"]')) {
      buffer = ''
      return
    }
    buffer = /^[a-z]$/i.test(event.key) ? (buffer + event.key.toLowerCase()).slice(-10) : ''
    if (buffer !== 'partymarty') return
    onActivate()
    powerMode.activate()
    if (active) {
      if (!faceEnabled) {
        faceEnabled = true
        play()
      }
      return
    }
    active = true
    video.src = sitePath('/doom/partymarty.mp4')
    play()
  }, { signal })
  video.addEventListener('error', () => fail(video.error), { signal })
  window.addEventListener('blur', () => { buffer = '' }, { signal })

  return {
    render(context: CanvasRenderingContext2D, now = performance.now()) {
      if (!active || !faceEnabled || paused) return
      const hud = isDoomGameplay(context)
      powerMode.render(hud, now)
      if (!hud || failed || video.readyState < 2) return
      const smoothing = context.imageSmoothingEnabled
      context.imageSmoothingEnabled = false
      context.drawImage(video, 143, 169, 35, 31)
      context.imageSmoothingEnabled = smoothing
    },
    setPaused(value: boolean) {
      paused = value
      if (paused) {
        buffer = ''
        video.pause()
      } else play()
    },
    setFaceEnabled(value: boolean) {
      faceEnabled = value
      if (value) play()
      else video.pause()
    },
    dispose() {
      active = false
      video.pause()
      video.removeAttribute('src')
      video.load()
    },
  }
}
