// Maps browser devicemotion data to the badge IMU's raw readings
// (ax, ay, az, gx, gy, gz). The badge reports about 16384 per g, and reads
// az ≈ -16384 lying face up, the same as a phone's +z gravity reading flipped.
const accelScale = 16384 / 9.80665
const gyroScale = 14.29
const interval = 16

type Vector = { x?: number | null; y?: number | null; z?: number | null }
type Rotation = { alpha?: number | null; beta?: number | null; gamma?: number | null }

const clamp = (value: number) => Math.max(-32768, Math.min(32767, Math.round(value) || 0))

export function badgeMotion(acceleration: Vector, rotation: Rotation | null | undefined, angle = 0) {
  if (typeof acceleration.x !== 'number') return null
  let x = acceleration.x
  let y = acceleration.y ?? 0
  const z = acceleration.z ?? 0
  // Device axes stay fixed to the hardware, so undo the screen rotation.
  const turn = ((Math.round(angle / 90) % 4) + 4) % 4
  if (turn === 1) [x, y] = [-y, x]
  else if (turn === 2) [x, y] = [-x, -y]
  else if (turn === 3) [x, y] = [y, -x]
  return [x * accelScale, -y * accelScale, -z * accelScale, (rotation?.beta ?? 0) * gyroScale, -(rotation?.gamma ?? 0) * gyroScale, -(rotation?.alpha ?? 0) * gyroScale].map(clamp)
}

export function initBadgeMotion(root: HTMLElement, send: (motion: number[]) => void, signal: AbortSignal) {
  let flipped = false
  let latest: number[] | null = null
  // Turning the badge 180° about the screen normal reverses its x and y axes.
  const emit = () => { if (latest) send(flipped ? latest.map((value, index) => index === 2 || index === 5 ? value : clamp(-value)) : latest) }
  const control = { setFlipped(value: boolean) { if (flipped === value) return; flipped = value; emit() } }
  if (typeof window.DeviceMotionEvent !== 'function') return control
  let last = 0
  window.addEventListener('devicemotion', event => {
    const now = performance.now()
    if (now - last < interval || !event.accelerationIncludingGravity) return
    const angle = screen.orientation?.angle ?? Number((window as { orientation?: number }).orientation ?? 0)
    const motion = badgeMotion(event.accelerationIncludingGravity, event.rotationRate, angle)
    if (!motion) return
    last = now
    latest = motion
    emit()
  }, { signal })
  // iOS only delivers motion after permission is granted from a user gesture.
  const request = (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission
  if (typeof request !== 'function') return control
  const ask = () => {
    root.removeEventListener('pointerup', ask)
    root.removeEventListener('keydown', ask)
    void request.call(DeviceMotionEvent).catch(() => {})
  }
  root.addEventListener('pointerup', ask, { signal })
  root.addEventListener('keydown', ask, { signal })
  return control
}
