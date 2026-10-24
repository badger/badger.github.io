export interface BadgeModelView {
  ready: Promise<void>
  updateFrame(): void
  setButtons(mask: number): void
  setBacklight(value: number): void
  setRotated?(value: boolean): void
  setDisplayRotated?(value: boolean): void
  capture?(width: number, height: number): HTMLCanvasElement
  dispose(): void
}

export function createBadgeModelController(load: (signal: AbortSignal, fail: (error: unknown) => void) => Promise<BadgeModelView>, fallback: (error: unknown) => void, timeout = 15000) {
  const abort = new AbortController()
  let view: BadgeModelView | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let started = false
  let mask = 0
  let backlight = 1
  let rotated = false
  let displayRotated = false

  function cleanup(candidate = view) {
    try { candidate?.dispose() } catch {}
  }

  function fail(error: unknown) {
    if (stopped) return
    stopped = true
    clearTimeout(timer)
    abort.abort()
    const previous = view
    view = undefined
    fallback(error)
    cleanup(previous)
  }

  function call(action: (view: BadgeModelView) => void) {
    if (!view || stopped) return
    try { action(view) } catch (error) { fail(error) }
  }

  return {
    start() {
      if (started || stopped) return
      started = true
      timer = setTimeout(() => fail(new Error('The 3D view took too long to load.')), timeout)
      void Promise.resolve().then(() => load(abort.signal, fail)).then(async candidate => {
        if (stopped) {
          cleanup(candidate)
          await candidate.ready.catch(() => {})
          return
        }
        view = candidate
        call(view => {
          view.setButtons(mask)
          view.setBacklight(backlight)
          view.setRotated?.(rotated)
          view.setDisplayRotated?.(displayRotated)
        })
        await candidate.ready
        if (!stopped) clearTimeout(timer)
      }).catch(fail)
    },
    updateFrame() { call(view => view.updateFrame()) },
    setButtons(value: number) { mask = value; call(view => view.setButtons(value)) },
    setBacklight(value: number) { backlight = value; call(view => view.setBacklight(value)) },
    setRotated(value: boolean) { rotated = value; call(view => view.setRotated?.(value)) },
    setDisplayRotated(value: boolean) { displayRotated = value; call(view => view.setDisplayRotated?.(value)) },
    capture(width: number, height: number) {
      if (!view?.capture || stopped) throw new Error('The 3D badge is unavailable. Reload to try again.')
      return view.capture(width, height)
    },
    dispose() {
      stopped = true
      clearTimeout(timer)
      abort.abort()
      const previous = view
      view = undefined
      cleanup(previous)
    },
  }
}
