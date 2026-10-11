export function initEditorSplit(onResize: () => void) {
  const layout = document.getElementById('editor-split')!
  const divider = document.getElementById('editor-divider')!
  const heightDivider = document.getElementById('editor-height-divider')!
  const workspace = document.getElementById('badge-editor')!
  const wide = window.matchMedia('(min-width: 1024px)')
  const defaultSplit = 56.5
  let split = defaultSplit
  let dragging: number | null = null
  let height = 620
  let heightDrag: { pointer: number; y: number; height: number; scale: number } | null = null
  try {
    const saved = Number(localStorage.getItem('badger-editor-split'))
    if (saved > 0 && saved < 100) split = saved
    const savedHeight = Number(localStorage.getItem('badger-editor-height'))
    if (savedHeight >= 320 && savedHeight <= 1600) height = savedHeight
  } catch {}

  function applyHeight(value: number, persist = false) {
    height = Math.round(Math.max(320, Math.min(1600, value)))
    workspace.style.setProperty('--workspace-height', `${height}px`)
    heightDivider.setAttribute('aria-valuenow', String(height))
    heightDivider.setAttribute('aria-valuetext', `Workspace height ${height} pixels`)
    onResize()
    if (persist) try { localStorage.setItem('badger-editor-height', String(height)) } catch {}
  }
  heightDivider.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    event.preventDefault()
    heightDrag = { pointer: event.pointerId, y: event.clientY, height, scale: wide.matches ? 1 : 2 }
    heightDivider.setPointerCapture(event.pointerId)
    heightDivider.focus()
    workspace.dataset.resizingHeight = 'true'
  })
  heightDivider.addEventListener('pointermove', event => {
    if (!heightDrag || event.pointerId !== heightDrag.pointer) return
    applyHeight(heightDrag.height + (event.clientY - heightDrag.y) / heightDrag.scale)
  })
  function finishHeight() {
    if (!heightDrag) return
    heightDrag = null
    delete workspace.dataset.resizingHeight
    applyHeight(height, true)
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) heightDivider.addEventListener(type, finishHeight)
  heightDivider.addEventListener('dblclick', () => applyHeight(620, true))
  heightDivider.addEventListener('keydown', event => {
    const step = event.shiftKey ? 120 : 40
    const values: Record<string, number> = { ArrowUp: height - step, ArrowDown: height + step, Home: 320, End: 1600, Enter: 620 }
    if (!(event.key in values)) return
    event.preventDefault()
    applyHeight(values[event.key], true)
  })

  function apply(value: number, persist = false) {
    const available = layout.clientWidth - divider.offsetWidth
    if (wide.matches && available > 0) {
      const minimum = 300 / available * 100
      const maximum = 100 - 280 / available * 100
      split = Math.max(minimum, Math.min(maximum, value))
      divider.setAttribute('aria-valuemin', String(Math.ceil(minimum)))
      divider.setAttribute('aria-valuemax', String(Math.floor(maximum)))
    } else split = value
    layout.style.setProperty('--code-share', `${split}fr`)
    layout.style.setProperty('--simulator-share', `${100 - split}fr`)
    divider.setAttribute('aria-valuenow', String(Math.round(split)))
    divider.setAttribute('aria-valuetext', `Code ${Math.round(split)} percent, simulator ${Math.round(100 - split)} percent`)
    onResize()
    if (persist) try { localStorage.setItem('badger-editor-split', String(split)) } catch {}
  }

  divider.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !wide.matches) return
    event.preventDefault()
    dragging = event.pointerId
    divider.setPointerCapture(event.pointerId)
    divider.focus()
    layout.dataset.resizing = 'true'
  })
  divider.addEventListener('pointermove', event => {
    if (dragging !== event.pointerId) return
    const bounds = layout.getBoundingClientRect()
    apply((event.clientX - bounds.left - divider.offsetWidth / 2) / (bounds.width - divider.offsetWidth) * 100)
  })
  function finish() {
    if (dragging === null) return
    dragging = null
    delete layout.dataset.resizing
    apply(split, true)
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) divider.addEventListener(type, finish)
  divider.addEventListener('dblclick', () => apply(defaultSplit, true))
  divider.addEventListener('keydown', event => {
    const step = event.shiftKey ? 10 : 2
    const values: Record<string, number> = { ArrowLeft: split - step, ArrowRight: split + step, Home: 0, End: 100, Enter: defaultSplit }
    if (!(event.key in values)) return
    event.preventDefault()
    apply(values[event.key], true)
  })
  const observer = new ResizeObserver(() => apply(split))
  observer.observe(layout)
  apply(split)
  applyHeight(height)
  return () => { finish(); finishHeight(); observer.disconnect() }
}
