export function badgeKey(key: string) {
  const keys: Record<string, number> = { ArrowLeft: 16, ArrowRight: 8, ArrowUp: 2, ArrowDown: 1, ' ': 4, Enter: 4, Escape: 32, w: 2048, a: 256, s: 4096, d: 512, j: 1024, k: 8192, u: 16384 }
  return keys[key.length === 1 ? key.toLowerCase() : key] || 0
}

export class BadgeInput {
  private held = new Map<string, number>()
  constructor(private changed: (mask: number) => void) {}

  set(source: string, bit: number, pressed: boolean) {
    if (pressed) this.held.set(source, bit)
    else this.held.delete(source)
    this.changed([...this.held.values()].reduce((mask, value) => mask | value, 0))
  }

  clear() {
    this.held.clear()
    this.changed(0)
  }
}

export function initBadgeKeyboard(scope: HTMLElement, input: BadgeInput) {
  const held = new Map<string, number>()
  const keyboard = (event: KeyboardEvent) => {
    const source = event.code || event.key
    if (event.type === 'keyup' && held.has(source)) {
      input.set(`key:${source}`, held.get(source)!, false)
      held.delete(source)
      event.preventDefault()
      event.stopPropagation()
      return
    }
    const target = event.target instanceof Element ? event.target : null
    if (event.type !== 'keydown' || event.metaKey || event.ctrlKey || event.altKey || event.isComposing || target?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return
    if (target?.closest('button') && [' ', 'Enter'].includes(event.key)) return
    const bit = badgeKey(event.key)
    if (!bit) return
    held.set(source, bit)
    input.set(`key:${source}`, bit, true)
    event.preventDefault()
    event.stopPropagation()
  }
  const clear = () => { held.clear(); input.clear() }
  const blur = (event: FocusEvent) => {
    if (!(event.relatedTarget instanceof Node) || !scope.contains(event.relatedTarget)) clear()
  }
  scope.addEventListener('keydown', keyboard)
  scope.addEventListener('keyup', keyboard)
  scope.addEventListener('focusout', blur)
  window.addEventListener('blur', clear)
  return () => {
    clear()
    scope.removeEventListener('keydown', keyboard)
    scope.removeEventListener('keyup', keyboard)
    scope.removeEventListener('focusout', blur)
    window.removeEventListener('blur', clear)
  }
}
