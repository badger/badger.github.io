export function initEditorFullscreen(onResize: () => void) {
  const workspace = document.getElementById('badge-editor')!
  const button = document.getElementById('toggle-fullscreen') as HTMLButtonElement
  let expanded = false
  let changing = false
  let previousOverflow = ''

  function apply(value: boolean) {
    if (value !== expanded) {
      if (value) {
        previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
      } else document.body.style.overflow = previousOverflow
    }
    expanded = value
    workspace.dataset.fullscreen = String(value)
    button.setAttribute('aria-pressed', String(value))
    button.setAttribute('aria-label', value ? 'Exit full screen' : 'Enter full screen')
    button.title = value ? 'Exit full screen (Escape)' : 'Enter full screen'
    onResize()
  }
  async function toggle() {
    if (changing) return
    changing = true
    try {
      if (expanded) {
        if (document.fullscreenElement === workspace) await document.exitFullscreen()
        apply(false)
      } else {
        if (document.fullscreenEnabled && workspace.requestFullscreen) {
          try { await workspace.requestFullscreen() } catch {}
        }
        apply(true)
      }
    } finally { changing = false }
  }
  const changed = () => apply(document.fullscreenElement === workspace)
  const keydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !expanded || workspace.querySelector('dialog[open]')) return
    event.preventDefault()
    void toggle().then(() => button.focus())
  }
  button.addEventListener('click', toggle)
  document.addEventListener('fullscreenchange', changed)
  document.addEventListener('keydown', keydown)
  return () => {
    apply(false)
    button.removeEventListener('click', toggle)
    document.removeEventListener('fullscreenchange', changed)
    document.removeEventListener('keydown', keydown)
  }
}
