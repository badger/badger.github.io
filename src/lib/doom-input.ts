export type DoomKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'ControlLeft' | 'Space' | 'ShiftLeft' | 'AltLeft' | 'Escape' | 'Enter'

const keyMap: Record<string, DoomKey | undefined> = {
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ControlLeft: 'ControlLeft',
  ControlRight: 'ControlLeft',
  KeyJ: 'ControlLeft',
  Space: 'Space',
  KeyK: 'Space',
  ShiftLeft: 'ShiftLeft',
  ShiftRight: 'ShiftLeft',
  AltLeft: 'AltLeft',
  AltRight: 'AltLeft',
  Escape: 'Escape',
  Enter: 'Enter',
}

const badgeDoomKeys: Record<number, DoomKey> = {
  16: 'ArrowLeft',
  8: 'ControlLeft',
  4: 'ArrowRight',
  2: 'ArrowUp',
  1: 'ArrowDown',
  32: 'Escape',
  256: 'ArrowLeft',
  512: 'ArrowRight',
  1024: 'ControlLeft',
  2048: 'ArrowUp',
  4096: 'ArrowDown',
  8192: 'Space',
  16384: 'AltLeft',
}

const oppositeDirection: Partial<Record<DoomKey, DoomKey>> = {
  ArrowLeft: 'ArrowRight',
  ArrowRight: 'ArrowLeft',
  ArrowUp: 'ArrowDown',
  ArrowDown: 'ArrowUp',
}

export function badgeDoomKey(bit: number, rotated = false) {
  const key = badgeDoomKeys[bit]
  return rotated && key ? oppositeDirection[key] ?? key : key
}

export function doomKey(event: Pick<KeyboardEvent, 'code'>) {
  return keyMap[event.code]
}

export function dispatchDoomCharacter(letter: string, type: 'keydown' | 'keypress' | 'keyup') {
  const key = letter.toLowerCase()
  const code = type === 'keypress' ? key.charCodeAt(0) : key.toUpperCase().charCodeAt(0)
  document.dispatchEvent(new KeyboardEvent(type, {
    key,
    code: `Key${key.toUpperCase()}`,
    keyCode: code,
    charCode: type === 'keypress' ? code : 0,
    which: code,
    bubbles: true,
    cancelable: true,
  }))
}

export class DoomUseDoubleTap {
  private pressedAt: number | undefined
  private releasedAt: number | undefined

  set(pressed: boolean, now = performance.now()) {
    if (pressed) {
      if (this.pressedAt !== undefined) return false
      this.pressedAt = now
      return false
    }
    if (this.pressedAt === undefined) return false
    const tapped = now - this.pressedAt <= 300
    const doubleTapped = tapped && this.releasedAt !== undefined && now - this.releasedAt <= 300
    this.pressedAt = undefined
    this.releasedAt = tapped && !doubleTapped ? now : undefined
    return doubleTapped
  }

  clear() {
    this.pressedAt = undefined
    this.releasedAt = undefined
  }
}

export class DoomInput {
  private held = new Map<string, DoomKey>()
  constructor(private changed: (key: DoomKey, pressed: boolean) => void) {}

  set(source: string, key: DoomKey, pressed: boolean) {
    if (pressed) {
      const previous = this.held.get(source)
      if (previous === key) return
      if (previous) {
        this.held.delete(source)
        if (![...this.held.values()].includes(previous)) this.changed(previous, false)
      }
      if ([...this.held.values()].includes(key)) {
        this.held.set(source, key)
        return
      }
      this.held.set(source, key)
      this.changed(key, true)
      return
    }
    const previous = this.held.get(source)
    this.held.delete(source)
    if (previous && ![...this.held.values()].includes(previous)) this.changed(previous, false)
  }

  clear() {
    const keys = new Set(this.held.values())
    this.held.clear()
    for (const key of keys) this.changed(key, false)
  }
}

export function initDoomKeyboard(scope: HTMLElement, input: DoomInput) {
  const held = new Map<string, DoomKey>()
  const keyboard = (event: KeyboardEvent) => {
    const source = event.code
    if (event.type === 'keyup' && held.has(source)) {
      input.set(`key:${source}`, held.get(source)!, false)
      held.delete(source)
      event.preventDefault()
      event.stopPropagation()
      return
    }
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('button, a[href], summary') && ['Space', 'Enter'].includes(event.code)) {
      event.stopPropagation()
      return
    }
    if (event.metaKey || event.isComposing || target?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return
    const key = doomKey(event)
    // SDL needs legacy character codes, which native browser events do not always supply.
    if (!key && !event.ctrlKey && !event.altKey && /^[a-z]$/i.test(event.key)) {
      dispatchDoomCharacter(event.key, event.type as 'keydown' | 'keypress' | 'keyup')
      event.stopPropagation()
      return
    }
    if (event.type !== 'keydown') return
    if (!key) return
    held.set(source, key)
    input.set(`key:${source}`, key, true)
    event.preventDefault()
    // The runtime receives a forwarded event; do not also deliver the native one.
    event.stopPropagation()
  }
  const clear = () => { held.clear(); input.clear() }
  scope.addEventListener('keydown', keyboard)
  scope.addEventListener('keypress', keyboard)
  scope.addEventListener('keyup', keyboard)
  window.addEventListener('blur', clear)
  return () => {
    clear()
    scope.removeEventListener('keydown', keyboard)
    scope.removeEventListener('keypress', keyboard)
    scope.removeEventListener('keyup', keyboard)
    window.removeEventListener('blur', clear)
  }
}
