export function initBadgeIdleRotation(host: HTMLElement, rotate: (seconds: number) => void) {
  const abort = new AbortController()
  const { signal } = abort
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const pointers = new Set<number>()
  const keys = new Set<string>()
  let hovering = host.matches(':hover')
  let visible = true
  let modalOpen = false
  let idleUntil = 0
  let frame = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let previous: number | undefined

  const blocked = () => signal.aborted || document.hidden || !visible || motion.matches || hovering || modalOpen || pointers.size > 0 || keys.size > 0
  const tick = (now: number) => {
    frame = 0
    if (blocked()) return
    if (previous !== undefined) rotate(Math.min((now - previous) / 1000, 0.1))
    previous = now
    frame = requestAnimationFrame(tick)
  }
  function schedule() {
    cancelAnimationFrame(frame)
    clearTimeout(timer)
    frame = 0
    previous = undefined
    if (blocked()) return
    const remaining = idleUntil - performance.now()
    if (remaining > 0) timer = setTimeout(schedule, remaining)
    else frame = requestAnimationFrame(tick)
  }
  const activity = () => {
    idleUntil = performance.now() + 30_000
    schedule()
  }
  host.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return
    hovering = true
    activity()
  }, { signal })
  host.addEventListener('pointerleave', () => {
    hovering = false
    activity()
  }, { signal })
  host.addEventListener('pointermove', activity, { signal })
  document.addEventListener('pointerdown', event => {
    pointers.add(event.pointerId)
    activity()
  }, { signal, capture: true })
  const release = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    activity()
  }
  window.addEventListener('pointerup', release, { signal, capture: true })
  window.addEventListener('pointercancel', release, { signal, capture: true })
  window.addEventListener('keydown', event => {
    keys.add(event.code)
    activity()
  }, { signal, capture: true })
  window.addEventListener('keyup', event => {
    keys.delete(event.code)
    activity()
  }, { signal, capture: true })
  document.addEventListener('wheel', activity, { signal, passive: true })
  window.addEventListener('blur', () => {
    pointers.clear()
    keys.clear()
    hovering = false
    activity()
  }, { signal })
  document.addEventListener('visibilitychange', activity, { signal })
  document.addEventListener('document-viewer:open', () => {
    modalOpen = true
    activity()
  }, { signal })
  document.addEventListener('document-viewer:close', () => {
    modalOpen = false
    activity()
  }, { signal })
  motion.addEventListener('change', activity, { signal })
  const observer = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting)
    schedule()
  })
  observer.observe(host)
  schedule()

  return {
    dispose() {
      abort.abort()
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      observer.disconnect()
    },
  }
}
