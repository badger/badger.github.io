import { createBadgeModelController } from './badge-editor-model-controller'
import { badgeDoomKey, DoomInput, initDoomKeyboard, type DoomKey } from './doom-input'
import { doomBadgeActions, type DoomBadgeAction } from './doom-badge-actions'
import { doomRotation } from './doom-orientation'
import { loadDoomRuntime, type DoomRuntime } from './doom-runtime'
import { createDoomPowerMode, createPartyMarty } from './doom-party-marty'
import { createDoomAvatar } from './doom-avatar'
import { withUniverseUsername } from './doom-share'
import { initDoomMobile } from './doom-mobile'
import { initDoomSelfie } from './doom-selfie'

function paintMessage(canvas: HTMLCanvasElement, title: string, lines: string[]) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return
  context.fillStyle = '#010409'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#5fed83'
  context.font = 'bold 15px monospace'
  context.fillText(title, 16, 35)
  context.fillStyle = '#909692'
  context.font = '11px monospace'
  lines.forEach((line, index) => context.fillText(line, 16, 64 + index * 18))
}

export function initDoomPage(root: HTMLElement) {
  console.info('%cNot-so-secret cheat code:%c Type @[YOUR-GITHUB-USERNAME] and then ENTER for a surprise.', 'font-weight: bold', 'font-weight: normal')
  const pageTitle = document.title
  const canvas = root.querySelector<HTMLCanvasElement>('[data-doom-screen]')!
  const runtimeCanvas = root.querySelector<HTMLCanvasElement>('[data-doom-runtime-screen]')!
  const modelHost = root.querySelector<HTMLElement>('[data-doom-model]')!
  const fallback = root.querySelector<HTMLElement>('[data-doom-fallback]')!
  const rotate = root.querySelector<HTMLButtonElement>('[data-model-rotate]')!
  const status = root.querySelector<HTMLElement>('[data-doom-status]')!
  const loadState = root.querySelector<HTMLElement>('[data-doom-load-state]')!
  const mobileView = window.matchMedia?.('(max-width: 1023px)')?.matches ?? false
  root.querySelector('[data-model-screen]')?.setAttribute('aria-pressed', 'false')
  root.querySelector('[data-model-full]')?.setAttribute('aria-pressed', 'true')
  // Touch controls do not use the engine's relative mouse input.
  if (mobileView) runtimeCanvas.requestPointerLock = async () => {}
  const video = root.querySelector<HTMLElement>('[data-doom-video]')!
  const videoFrame = root.querySelector<HTMLIFrameElement>('[data-doom-video-frame]')!
  const videoToolbar = root.querySelector<HTMLElement>('[data-doom-video-toolbar]')!
  const videoClose = root.querySelector<HTMLButtonElement>('[data-doom-video-close]')!
  const keys = [...root.querySelectorAll<HTMLButtonElement>('[data-doom-button]')]
  const controls = {
    screen: root.querySelector<HTMLButtonElement>('[data-model-screen]')!,
    full: root.querySelector<HTMLButtonElement>('[data-model-full]')!,
    status: root.querySelector<HTMLElement>('[data-model-status]')!,
    zoomIn: root.querySelector<HTMLButtonElement>('[data-model-zoom-in]')!,
    zoomOut: root.querySelector<HTMLButtonElement>('[data-model-zoom-out]')!,
    displayFit: 'stretch' as const,
    idleRotation: !mobileView,
    capture: new URLSearchParams(globalThis.location?.search).has('capture'),
    displayOverlay: video,
    canvasLabel: 'Interactive 3D badge. Drag to rotate, scroll to zoom. Touch pads and keyboard control Doom. Lower physical buttons: left opens r/itrunsdoom, middle opens Can it run Doom, right opens Doom source, up plays a video in the badge, down opens GitHub Universe.',
  }
  const abort = new AbortController()
  const { signal } = abort
  let runtime: DoomRuntime | undefined
  let mobile: ReturnType<typeof initDoomMobile> | undefined
  let audio: AudioContext | undefined
  let bootPromise: Promise<void> | undefined
  let badgeMask = 0
  let rotated = false
  let fallbackMode = false
  let documentOpen = false
  let videoOpen = false
  let runtimeStatus = { message: status.textContent, state: loadState.textContent }
  type BadgeSource = { id: string, modelRelative: boolean }
  const badgeSources = new Map<string, { bit: number, modelRelative: boolean }>()

  paintMessage(canvas, 'LOADING DOOM', ['Verifying local engine and WAD assets.', 'Audio unlocks on first input.'])

  const input = new DoomInput((key, pressed) => runtime?.key(key, pressed))
  const clearBadgeInput = () => {
    badgeSources.clear()
    badgeMask = 0
    model.setButtons(0)
    for (const key of keys) key.dataset.pressed = 'false'
    input.clear()
    mobile?.clear()
  }
  let removeKeyboard = initDoomKeyboard(root, input)
  function setRuntimeStatus(message: string, state: string) {
    runtimeStatus = { message, state }
    if (videoOpen) return
    status.textContent = message
    status.hidden = state === 'Running'
    loadState.textContent = state
  }
  const powerMode = createDoomPowerMode()
  const partyMarty = createPartyMarty(root, root.querySelector<HTMLVideoElement>('[data-party-marty-video]')!, signal, message => {
    setRuntimeStatus(message, 'Video unavailable')
  }, powerMode, () => avatar.clear())
  const avatar = createDoomAvatar(root, signal, powerMode, clearBadgeInput, () => partyMarty.setFaceEnabled(false))
  const selfie = initDoomSelfie(document.querySelector<HTMLElement>('[data-doom-share]') ?? root, () => {
    clearBadgeInput()
    return model.capture(1200, 630)
  }, signal)
  const syncSelfie = () => {
    selfie.setReady(!videoOpen && !documentOpen && !fallbackMode && modelHost.dataset.state === 'ready')
  }
  const pauseOverlays = (paused: boolean) => {
    partyMarty.setPaused(paused)
    avatar.setPaused(paused)
  }
  function openVideo() {
    if (videoOpen) return
    videoOpen = true
    selfie.setReady(false)
    clearBadgeInput()
    removeKeyboard()
    runtime?.pause()
    pauseOverlays(true)
    video.hidden = false
    videoToolbar.hidden = false
    for (const key of keys) key.disabled = true
    for (const key of root.querySelectorAll<HTMLButtonElement>('[data-doom-key]')) key.disabled = true
    videoFrame.src = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0'
    status.textContent = 'YouTube video · Return to Doom to resume the game'
    status.hidden = false
    loadState.textContent = 'Video'
    videoClose.focus({ preventScroll: true })
    model.updateFrame()
  }
  function closeVideo() {
    if (!videoOpen) return
    videoOpen = false
    videoFrame.removeAttribute('src')
    video.hidden = true
    videoToolbar.hidden = true
    for (const key of keys) key.disabled = false
    for (const key of root.querySelectorAll<HTMLButtonElement>('[data-doom-key]')) key.disabled = false
    status.textContent = runtimeStatus.message
    status.hidden = runtimeStatus.state === 'Running'
    loadState.textContent = runtimeStatus.state
    removeKeyboard = initDoomKeyboard(root, input)
    if (!document.hidden && !documentOpen) runtime?.resume()
    pauseOverlays(document.hidden || documentOpen)
    syncSelfie()
    if (fallbackMode) canvas.focus({ preventScroll: true })
    else modelHost.querySelector<HTMLElement>('canvas[role="img"]')?.focus({ preventScroll: true })
  }
  function activateBadgeAction(action: DoomBadgeAction) {
    if (action.kind === 'video') openVideo()
    else window.open(withUniverseUsername(action.href, new URLSearchParams(globalThis.location?.search).get('u') ?? ''), '_blank', 'noopener,noreferrer')
  }
  const updateFrame = () => {
    const context = canvas.getContext('2d')
    if (context && runtimeCanvas.width && runtimeCanvas.height) {
      context.drawImage(runtimeCanvas, 0, 0, runtimeCanvas.width, runtimeCanvas.height, 0, 0, canvas.width, canvas.height)
      partyMarty.render(context)
      avatar.render(context)
    }
    model.updateFrame()
    syncSelfie()
  }
  const setBadge = (source: BadgeSource, bit: number, pressed: boolean) => {
    if (pressed) badgeSources.set(source.id, { bit, modelRelative: source.modelRelative })
    else badgeSources.delete(source.id)
    badgeMask = [...badgeSources.values()].reduce((mask, value) => mask | value.bit, 0)
    model.setButtons(badgeMask)
    for (const key of keys) key.dataset.pressed = String(Boolean(badgeMask & Number(key.dataset.badgeBit)))
    const action = source.modelRelative && doomBadgeActions.find(action => action.bit === bit)
    if (action) {
      if (pressed) activateBadgeAction(action)
      return
    }
    if (videoOpen) return
    const doom = badgeDoomKey(bit, source.modelRelative && rotated)
    if (doom) input.set(source.id, doom, pressed)
  }

  const applyOrientation = (requested: boolean) => {
    rotated = doomRotation(requested, fallbackMode)
    rotate.setAttribute('aria-pressed', String(rotated))
    model.setRotated(rotated)
    model.setDisplayRotated(rotated)
    for (const [source, { bit, modelRelative }] of badgeSources) {
      if (!modelRelative) continue
      if (doomBadgeActions.some(action => action.bit === bit)) continue
      const doom = badgeDoomKey(bit, rotated)
      if (doom) input.set(source, doom, true)
    }
  }

  const showFallback = (reason: unknown) => {
    console.warn('Doom 3D badge view unavailable; using the 2D display.', reason)
    fallbackMode = true
    selfie.setReady(false)
    rotate.disabled = true
    applyOrientation(false)
    modelHost.dataset.state = 'fallback'
    fallback.hidden = false
    video.removeAttribute('style')
    fallback.append(video)
    controls.status.textContent = 'WebGL unavailable · 2D display active'
  }
  const model = createBadgeModelController(async (modelSignal, fail) => {
    const { initBadgeModel } = await import('./badge-editor-model')
    const view = initBadgeModel(modelHost, canvas, (bit, pressed) => setBadge({ id: `model:${bit}`, modelRelative: true }, bit, pressed), modelSignal, fail, controls)
    void view.ready.then(() => {
      fallbackMode = false
      rotate.disabled = false
      modelHost.dataset.state = 'ready'
      fallback.hidden = true
      syncSelfie()
    }, () => {})
    return view
  }, showFallback)

  function ensureAudio() {
    const Audio = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Audio || audio) return audio
    try {
      audio = new Audio()
    } catch (error) {
      console.warn('Doom audio context could not be created.', error)
    }
    return audio
  }

  function unlockAudio() {
    const context = ensureAudio()
    if (context?.state === 'suspended') void context.resume().catch(error => {
      console.warn('Doom audio could not be resumed.', error)
    })
  }

  function boot() {
    if (bootPromise) return bootPromise
    bootPromise = (async () => {
      setRuntimeStatus('Checking exact WAD and runtime hashes', 'Loading')
      model.start()
      try {
        runtime = await loadDoomRuntime(runtimeCanvas, signal, '/doom', ensureAudio(), updateFrame)
        if (signal.aborted) return
        document.title = pageTitle
        setRuntimeStatus('Running approved Doom runtime with Doom 1 v1.9 shareware', 'Running')
        if (documentOpen || document.hidden || videoOpen) runtime.pause()
        else if (!mobileView) canvas.focus()
        updateFrame()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setRuntimeStatus(message, 'Assets unavailable')
        paintMessage(canvas, 'VERIFIED ASSETS REQUIRED', [
          'The committed Doom assets failed verification.',
          'Rebuild the pinned engine and shareware bundle.',
          'See public/doom/README.md.',
        ])
        model.updateFrame()
      }
    })()
    return bootPromise
  }

  root.addEventListener('pointerdown', unlockAudio, { signal, once: true, capture: true })
  root.addEventListener('keydown', unlockAudio, { signal, once: true, capture: true })
  rotate.addEventListener('click', () => applyOrientation(!rotated), { signal })
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-doom-video-open]')) {
    button.addEventListener('click', openVideo, { signal })
  }
  videoClose.addEventListener('click', closeVideo, { signal })
  mobile = initDoomMobile(root, {
    key: (source, key, pressed) => {
      if (!videoOpen && !documentOpen) input.set(source, key, pressed)
    },
    release: clearBadgeInput,
  }, signal)
  for (const key of keys) {
    const bit = Number(key.dataset.badgeBit)
    const source = { id: `button:${bit}`, modelRelative: false }
    const release = () => setBadge(source, bit, false)
    key.addEventListener('pointerdown', event => {
      if (event.button !== 0) return
      key.setPointerCapture(event.pointerId)
      setBadge(source, bit, true)
    }, { signal })
    key.addEventListener('pointerup', release, { signal })
    key.addEventListener('pointercancel', release, { signal })
    key.addEventListener('lostpointercapture', release, { signal })
    key.addEventListener('contextmenu', event => event.preventDefault(), { signal })
    key.addEventListener('click', event => {
      if (event.detail !== 0) return
      const clickSource = { id: `click:${bit}`, modelRelative: false }
      setBadge(clickSource, bit, true)
      window.setTimeout(() => setBadge(clickSource, bit, false), 150)
    }, { signal })
  }

  window.addEventListener('blur', clearBadgeInput, { signal })
  document.addEventListener('document-viewer:open', () => {
    documentOpen = true
    selfie.setReady(false)
    pauseOverlays(true)
    clearBadgeInput()
    runtime?.pause()
  }, { signal })
  document.addEventListener('document-viewer:close', () => {
    documentOpen = false
    pauseOverlays(document.hidden || videoOpen)
    if (!document.hidden && !videoOpen) runtime?.resume()
    syncSelfie()
  }, { signal })
  document.addEventListener('visibilitychange', () => {
    clearBadgeInput()
    pauseOverlays(document.hidden || documentOpen || videoOpen)
    if (document.hidden || documentOpen || videoOpen) runtime?.pause()
    else runtime?.resume()
  }, { signal })
  window.addEventListener('pagehide', () => {
    partyMarty.dispose()
    avatar.dispose()
    videoFrame.removeAttribute('src')
    clearBadgeInput()
    void runtime?.syncSaves().catch(() => {})
    runtime?.dispose()
    model.dispose()
    audio?.close().catch(() => {})
    abort.abort()
    removeKeyboard()
  }, { signal })

  void boot()

  return {
    start: boot,
    key(key: DoomKey, pressed: boolean) { if (!videoOpen) input.set(`api:${key}`, key, pressed) },
    dispose() {
      partyMarty.dispose()
      avatar.dispose()
      videoFrame.removeAttribute('src')
      clearBadgeInput()
      void runtime?.syncSaves().catch(() => {})
      runtime?.dispose()
      model.dispose()
      audio?.close().catch(() => {})
      abort.abort()
      removeKeyboard()
    },
  }
}
