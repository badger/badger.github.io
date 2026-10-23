import { Box3, CanvasTexture, DirectionalLight, DoubleSide, HemisphereLight, LinearFilter, Mesh, MeshBasicMaterial, MeshStandardMaterial, NearestFilter, PerspectiveCamera, Raycaster, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer, type Material, type Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { displayOverlayMatrix } from './badge-display-overlay'
import { initBadgeIdleRotation } from './badge-model-idle-rotation'
import { sitePath } from './site-path'

// Corner radius of the badge model's inner circuit board, in model units (metres).
const BOARD_CORNER_RADIUS = 0.0037

export interface BadgeModelControls {
  screen: HTMLButtonElement
  full?: HTMLButtonElement
  status: HTMLElement
  zoomIn?: HTMLButtonElement
  zoomOut?: HTMLButtonElement
  displayFit?: 'contain' | 'stretch'
  idleRotation?: boolean
  capture?: boolean
  displayOverlay?: HTMLElement
  canvasLabel?: string
}

// Touch pads printed on the front_top artwork, in pixels of its 422x534 texture.
// Bits match the gamepad mask read by editor_support (see badger/home input_test).
type Pad = { bit: number; shape: 'circle' | 'box' | 'pill'; x0: number; y0: number; x1: number; y1: number }
const padTexture = { width: 422, height: 534 }
export const touchPads: Pad[] = [
  { bit: 1024, shape: 'circle', x0: 94, y0: 402, x1: 141, y1: 448 },
  { bit: 8192, shape: 'circle', x0: 50, y0: 446, x1: 96, y1: 493 },
  { bit: 2048, shape: 'box', x0: 297, y0: 403, x1: 333, y1: 439 },
  { bit: 256, shape: 'box', x0: 262, y0: 439, x1: 298, y1: 475 },
  { bit: 512, shape: 'box', x0: 332, y0: 439, x1: 368, y1: 475 },
  { bit: 4096, shape: 'box', x0: 297, y0: 474, x1: 333, y1: 510 },
  { bit: 16384, shape: 'pill', x0: 161, y0: 471, x1: 192, y1: 502 },
  { bit: 32, shape: 'pill', x0: 196, y0: 471, x1: 227, y1: 502 },
]

export function touchPadAt(u: number, v: number) {
  const x = u * padTexture.width
  const y = v * padTexture.height
  return touchPads.find(pad => x >= pad.x0 && x <= pad.x1 && y >= pad.y0 && y <= pad.y1)?.bit ?? 0
}

export const zoomStep = 0.05

export function initBadgeModel(host: HTMLElement, screen: HTMLCanvasElement, button: (bit: number, pressed: boolean) => void, signal: AbortSignal, onError: (error: unknown) => void, elements?: BadgeModelControls) {
  const display = document.createElement('canvas')
  display.width = 640
  display.height = 438
  const displayContext = display.getContext('2d')
  if (!displayContext) throw new Error('Canvas rendering is unavailable.')
  const context = displayContext
  const renderer = new WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = SRGBColorSpace
  const canvas = renderer.domElement
  canvas.tabIndex = 0
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', elements?.canvasLabel ?? 'Interactive 3D badge. Drag to rotate, scroll to zoom. Arrow keys control the badge, Space selects. WASD and J control the gamepad.')
  host.append(canvas)
  const displayOverlay = elements?.displayOverlay
  const scene = new Scene()
  const camera = new PerspectiveCamera(35, 1, 0.001, 2)
  const controls = new OrbitControls(camera, canvas)
  controls.enablePan = false
  controls.minDistance = 0.025
  controls.maxDistance = 0.6
  scene.add(new HemisphereLight(0xffffff, 0x303030, 2.5))
  const key = new DirectionalLight(0xffffff, 3)
  key.position.set(-0.1, 0.15, 0.3)
  scene.add(key)
  const fill = new DirectionalLight(0xffffff, 1.5)
  fill.position.set(0.2, -0.1, -0.2)
  scene.add(fill)
  const texture = new CanvasTexture(display)
  texture.colorSpace = SRGBColorSpace
  texture.flipY = false
  texture.magFilter = NearestFilter
  texture.minFilter = LinearFilter
  texture.generateMipmaps = false
  const displayMaterial = new MeshBasicMaterial({ map: texture, side: DoubleSide, toneMapped: false, transparent: true, depthWrite: false })
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const targets = new Map<Object3D, number>()
  const caps = new Map<number, { mesh: Mesh; z: number; material: MeshStandardMaterial }>()
  const discarded = new Set<Material>()
  const screenButton = elements?.screen ?? document.getElementById('focus-badge-screen') as HTMLButtonElement
  const fullButton = elements?.full ?? document.getElementById('focus-badge-full') as HTMLButtonElement | null
  const status = elements?.status ?? document.getElementById('model-status')!
  let model: Object3D | undefined
  let displayMesh: Mesh | undefined
  let artwork: { mesh: Mesh; material: MeshStandardMaterial; source: CanvasImageSource; canvas: HTMLCanvasElement; texture: CanvasTexture } | undefined
  let padMask = 0
  const active = new Map<number, number>()
  let mask = 0
  let frame = 0
  let disposed = false
  let screenView = screenButton.getAttribute('aria-pressed') === 'true'
  let rotated = false
  let displayRotated = false
  let idleRotation: ReturnType<typeof initBadgeIdleRotation> | undefined

  function render() {
    if (disposed || frame || document.hidden) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (disposed) return
      try {
        renderer.render(scene, camera)
        renderOverlay()
      } catch (error) { onError(error) }
    })
  }
  function renderOverlay() {
    if (!displayOverlay || !displayMesh || displayOverlay.hidden) return
    const matrix = displayOverlayMatrix(displayMesh, camera, host.clientWidth, host.clientHeight, displayRotated)
    displayOverlay.style.visibility = matrix ? 'visible' : 'hidden'
    if (matrix) displayOverlay.style.transform = `matrix3d(${matrix.elements.join(',')})`
  }
  function updateFrame() {
    context.fillStyle = '#000'
    context.fillRect(0, 0, display.width, display.height)
    context.imageSmoothingEnabled = false
    context.save()
    if (displayRotated) {
      context.translate(display.width, display.height)
      context.rotate(Math.PI)
    }
    if (elements?.displayFit === 'stretch') {
      context.drawImage(screen, 0, 0, display.width, display.height)
    } else {
      const scale = Math.min(display.width / screen.width, display.height / screen.height)
      context.drawImage(screen, (display.width - screen.width * scale) / 2, (display.height - screen.height * scale) / 2, screen.width * scale, screen.height * scale)
    }
    context.restore()
    texture.needsUpdate = true
    render()
  }
  function paintPads() {
    if (!artwork) return
    const pressed = touchPads.reduce((bits, pad) => bits | (mask & pad.bit), 0)
    if (pressed === padMask) return
    padMask = pressed
    const { canvas: art, source } = artwork
    const paint = art.getContext('2d')
    if (!paint) return
    paint.drawImage(source, 0, 0, art.width, art.height)
    paint.save()
    paint.scale(art.width / padTexture.width, art.height / padTexture.height)
    paint.globalAlpha = 0.6
    paint.fillStyle = paint.strokeStyle = '#5fed83'
    paint.lineCap = 'round'
    paint.lineWidth = 13
    for (const pad of touchPads) {
      if (!(pressed & pad.bit)) continue
      paint.beginPath()
      if (pad.shape === 'box') paint.fillRect(pad.x0, pad.y0, pad.x1 - pad.x0, pad.y1 - pad.y0)
      else if (pad.shape === 'circle') { paint.arc((pad.x0 + pad.x1) / 2, (pad.y0 + pad.y1) / 2, (pad.x1 - pad.x0) / 2, 0, Math.PI * 2); paint.fill() }
      else { paint.moveTo(pad.x0 + 6, pad.y1 - 6); paint.lineTo(pad.x1 - 6, pad.y0 + 6); paint.stroke() }
    }
    paint.restore()
    artwork.texture.needsUpdate = true
  }
  function setButtons(value: number) {
    mask = value
    for (const [bit, cap] of caps) {
      const pressed = Boolean(value & bit)
      cap.mesh.position.z = cap.z - (pressed ? 0.0012 : 0)
      cap.material.emissive.setHex(pressed ? 0x5fed83 : 0)
      cap.material.emissiveIntensity = pressed ? 0.6 : 0
    }
    paintPads()
    render()
  }
  function zoom(direction: 1 | -1) {
    if (!model) return
    const offset = camera.position.clone().sub(controls.target)
    const distance = Math.min(controls.maxDistance, Math.max(controls.minDistance, offset.length() * (direction > 0 ? 1 - zoomStep : 1 / (1 - zoomStep))))
    camera.position.copy(controls.target).add(offset.setLength(distance))
    controls.update()
    render()
  }
  const zoomIn = () => zoom(1)
  const zoomOut = () => zoom(-1)
  function framing(object: Object3D, margin: number) {
    const bounds = new Box3().setFromObject(object)
    const size = bounds.getSize(new Vector3())
    const distance = Math.max(size.y, size.x / camera.aspect) / (2 * Math.tan(camera.fov * Math.PI / 360)) * margin
    return { center: bounds.getCenter(new Vector3()), distance }
  }
  // Zoom toward the screen: slide the orbit target from the model centre (zoomed
  // out) to the screen centre (zoomed in), keeping the current view direction.
  let focusing = false
  function focusZoom() {
    if (focusing || !model || !displayMesh) return
    const whole = framing(model, 1.12)
    const close = framing(displayMesh, 1.25)
    const distance = camera.position.distanceTo(controls.target)
    const t = Math.min(1, Math.max(0, (distance - close.distance) / (whole.distance - close.distance)))
    const shift = close.center.lerp(whole.center, t).sub(controls.target)
    if (shift.lengthSq() < 1e-12) return
    focusing = true
    controls.target.add(shift)
    camera.position.add(shift)
    controls.update()
    focusing = false
  }
  function view() {
    if (!model) return
    const { center, distance } = framing(screenView && displayMesh ? displayMesh : model, screenView ? 1.25 : 1.12)
    controls.target.copy(center)
    const angled = elements?.idleRotation && !screenView
    camera.position.copy(center).add(new Vector3(screenView ? 0 : distance * (angled ? 0.2 : 0.04), screenView ? 0 : distance * (angled ? 0.08 : 0.02), distance))
    controls.update()
    render()
  }
  const setView = (value: boolean) => {
    screenView = value
    screenButton.setAttribute('aria-pressed', String(value))
    fullButton?.setAttribute('aria-pressed', String(!value))
    view()
  }
  const focusScreen = () => setView(true)
  const showFull = () => setView(false)
  // Turn the badge 180° about the view axis, pivoting on its centre so the
  // camera stays put; focusZoom then follows the screen to its new position.
  function applyRotation() {
    if (!model) return
    const before = new Box3().setFromObject(model).getCenter(new Vector3())
    model.rotation.z = rotated ? Math.PI : 0
    model.updateMatrixWorld(true)
    model.position.add(before.sub(new Box3().setFromObject(model).getCenter(new Vector3())))
    model.updateMatrixWorld(true)
    if (screenView) view()
    else { focusZoom(); controls.update(); render() }
  }
  function setRotated(value: boolean) {
    if (value === rotated) return
    rotated = value
    applyRotation()
  }
  function setDisplayRotated(value: boolean) {
    if (value === displayRotated) return
    displayRotated = value
    updateFrame()
  }
  const resize = new ResizeObserver(() => {
    if (disposed || !host.clientWidth || !host.clientHeight) return
    try {
      renderer.setSize(host.clientWidth, host.clientHeight, false)
      camera.aspect = host.clientWidth / host.clientHeight
      camera.updateProjectionMatrix()
      render()
    } catch (error) { onError(error) }
  })
  resize.observe(host)
  const hit = (event: PointerEvent) => {
    if (!model) return 0
    const rect = canvas.getBoundingClientRect()
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    model.updateMatrixWorld(true)
    const first = raycaster.intersectObject(model, true).find(hit => {
      const mesh = hit.object as Mesh
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      return mesh.visible && materials.some(material => material && material.opacity >= 0.5)
    })
    if (!first) return 0
    const target = targets.get(first.object)
    if (target) return target
    return artwork && first.object === artwork.mesh && first.uv ? touchPadAt(first.uv.x, first.uv.y) : 0
  }
  const down = (event: PointerEvent) => {
    canvas.focus({ preventScroll: true })
    if (event.button !== 0 || active.has(event.pointerId)) return
    const bit = hit(event)
    if (!bit) return
    event.preventDefault()
    event.stopImmediatePropagation()
    controls.enabled = false
    active.set(event.pointerId, bit)
    try { canvas.setPointerCapture(event.pointerId) } catch {}
    button(bit, true)
  }
  const release = (pointer?: number) => {
    const pointers = pointer === undefined ? [...active.keys()] : [pointer]
    for (const id of pointers) {
      const bit = active.get(id)
      if (!bit) continue
      active.delete(id)
      button(bit, false)
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id)
    }
    if (!active.size) controls.enabled = true
  }
  const up = (event: PointerEvent) => {
    if (!active.has(event.pointerId)) return
    event.stopImmediatePropagation()
    release(event.pointerId)
  }
  const move = (event: PointerEvent) => { canvas.style.cursor = active.size || hit(event) ? 'pointer' : 'grab' }
  const lost = (event: Event) => {
    event.preventDefault()
    onError(new Error('The browser lost its 3D graphics context.'))
  }
  canvas.addEventListener('pointerdown', down, true)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up, true)
  canvas.addEventListener('pointercancel', up, true)
  const lostCapture = (event: PointerEvent) => release(event.pointerId)
  canvas.addEventListener('lostpointercapture', lostCapture)
  canvas.addEventListener('webglcontextlost', lost)
  const releaseAll = () => release()
  window.addEventListener('blur', releaseAll)
  document.addEventListener('visibilitychange', releaseAll)
  controls.addEventListener('change', focusZoom)
  controls.addEventListener('change', render)
  screenButton.addEventListener('click', focusScreen)
  fullButton?.addEventListener('click', showFull)
  elements?.zoomIn?.addEventListener('click', zoomIn)
  elements?.zoomOut?.addEventListener('click', zoomOut)
  const ready = fetch(sitePath('/simulator/models/github-mona-badge.glb'), { signal }).then(async response => {
    if (!response.ok) throw new Error(`Could not load the badge model (HTTP ${response.status}).`)
    const data = await response.arrayBuffer()
    signal.throwIfAborted()
    return new GLTFLoader().parseAsync(data, sitePath('/simulator/models/'))
  }).then(gltf => {
    model = gltf.scene
    scene.add(model)
    model.traverse(object => {
      if (!(object instanceof Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      if (materials.some(material => material.name === 'MONA OS display bright pixel graphics')) {
        materials.forEach(material => discarded.add(material))
        object.material = displayMaterial
        object.renderOrder = 10
        displayMesh = object
        if (displayOverlay) {
          object.geometry.computeBoundingBox()
          host.append(displayOverlay)
        }
      }
      if (materials.some(material => material.transparent)) materials.forEach(material => { material.depthWrite = false })
      const art = materials[0] as MeshStandardMaterial
      if (art.name === 'front_top' && art.map?.image && !artwork) {
        const source = art.map.image as CanvasImageSource & { width: number; height: number }
        const canvas = document.createElement('canvas')
        canvas.width = source.width
        canvas.height = source.height
        canvas.getContext('2d')?.drawImage(source, 0, 0)
        const texture = new CanvasTexture(canvas)
        texture.colorSpace = SRGBColorSpace
        texture.flipY = art.map.flipY
        texture.wrapS = art.map.wrapS
        texture.wrapT = art.map.wrapT
        texture.anisotropy = art.map.anisotropy
        texture.channel = art.map.channel
        art.map.dispose()
        art.map = texture
        artwork = { mesh: object, material: art, source, canvas, texture }
      }
      const match = object.name.match(/Black_tactile_control_(left|middle|right|up|down)$/)
      if (match) {
        const bit = ({ left: 16, middle: 8, right: 4, up: 2, down: 1 } as Record<string, number>)[match[1]]
        const material = (materials[0] as MeshStandardMaterial).clone()
        materials.forEach(material => discarded.add(material))
        object.material = material
        caps.set(bit, { mesh: object, z: object.position.z, material })
        targets.set(object, bit)
        const collar = model!.getObjectByName(object.name.replace('Black_tactile_control', 'Metal_button_collar'))
        if (collar) targets.set(collar, bit)
      }
    })
    if (!displayMesh || caps.size !== 5) throw new Error('The badge model is missing its screen or controls.')
    roundPanels(model)
    if (disposed) { disposeModel(); return }
    updateFrame()
    setButtons(mask)
    view()
    if (rotated) applyRotation()
    renderer.render(scene, camera)
    renderOverlay()
    if (disposed || signal.aborted) return
    host.dataset.state = 'ready'
    status.hidden = true
    screenButton.disabled = false
    if (fullButton) fullButton.disabled = false
    if (elements?.zoomIn) elements.zoomIn.disabled = false
    if (elements?.zoomOut) elements.zoomOut.disabled = false
    if (elements?.capture) {
      const target = controls.target.clone()
      const offset = camera.position.clone().sub(target)
      const capture = (event: Event) => {
        const { angle } = (event as CustomEvent<{ angle: number }>).detail
        if (!Number.isFinite(angle)) throw new Error('Capture angle must be finite.')
        controls.target.copy(target)
        camera.position.copy(offset).applyAxisAngle(camera.up, angle).add(target)
        controls.update()
        updateFrame()
        cancelAnimationFrame(frame)
        frame = 0
        renderer.render(scene, camera)
      }
      host.addEventListener('badge:capture', capture, { signal })
      host.dataset.captureReady = 'true'
    } else if (elements?.idleRotation) {
      idleRotation = initBadgeIdleRotation(host, seconds => {
        camera.position.sub(controls.target).applyAxisAngle(camera.up, seconds * 0.06).add(controls.target)
        controls.update()
        render()
      })
    }
  })

  // The front and back artwork are flat rectangles, so clip them to the
  // rounded outline of the circuit board they sit on.
  function roundPanels(root: Object3D) {
    const board = root.getObjectByName('Inside_violet_circuit_board')
    if (!board) return
    const outline = new Box3().setFromObject(board)
    for (const name of ['Front_electronic_assembly_face', 'Back_electronics_silkscreen_print']) {
      const panel = root.getObjectByName(name)
      if (!(panel instanceof Mesh) || Array.isArray(panel.material)) continue
      const bounds = new Box3().setFromObject(panel)
      const width = bounds.max.x - bounds.min.x
      const height = bounds.max.y - bounds.min.y
      const mask = document.createElement('canvas')
      mask.width = 1024
      mask.height = Math.round(1024 * height / width)
      const scale = mask.width / width
      const draw = mask.getContext('2d')
      if (!draw) continue
      draw.fillStyle = '#000'
      draw.fillRect(0, 0, mask.width, mask.height)
      draw.fillStyle = '#fff'
      draw.beginPath()
      draw.roundRect((outline.min.x - bounds.min.x) * scale, (bounds.max.y - outline.max.y) * scale, (outline.max.x - outline.min.x) * scale, (outline.max.y - outline.min.y) * scale, BOARD_CORNER_RADIUS * scale)
      draw.fill()
      const alphaMap = new CanvasTexture(mask)
      alphaMap.flipY = false
      const material = panel.material as MeshStandardMaterial
      material.alphaMap = alphaMap
      material.alphaTest = 0.5
      material.needsUpdate = true
    }
  }

  function disposeModel() {
    const materials = new Set(discarded)
    const textures = new Set([texture])
    model?.traverse(object => {
      if (!(object instanceof Mesh)) return
      object.geometry.dispose()
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
    })
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
      material.dispose()
    }
    textures.forEach(texture => texture.dispose())
  }
  return {
    ready,
    updateFrame,
    setButtons,
    zoom,
    setRotated,
    setDisplayRotated,
    capture(width: number, height: number) {
      if (!model || disposed) throw new Error('The 3D badge is not ready.')
      const image = document.createElement('canvas')
      image.width = width
      image.height = height
      const paint = image.getContext('2d')
      if (!paint) throw new Error('Image export is unavailable in this browser.')
      updateFrame()
      renderer.render(scene, camera)
      const scale = Math.min(width / canvas.width, height / canvas.height)
      const drawWidth = canvas.width * scale
      const drawHeight = canvas.height * scale
      paint.drawImage(canvas, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
      return image
    },
    setBacklight(value: number) { displayMaterial.color.setScalar(Math.max(0, Math.min(1, value))); render() },
    dispose() {
      if (disposed) return
      disposed = true
      idleRotation?.dispose()
      releaseAll()
      cancelAnimationFrame(frame)
      resize.disconnect()
      controls.dispose()
      screenButton.removeEventListener('click', focusScreen)
      fullButton?.removeEventListener('click', showFull)
      elements?.zoomIn?.removeEventListener('click', zoomIn)
      elements?.zoomOut?.removeEventListener('click', zoomOut)
      window.removeEventListener('blur', releaseAll)
      document.removeEventListener('visibilitychange', releaseAll)
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('lostpointercapture', lostCapture)
      disposeModel()
      displayMaterial.dispose()
      renderer.dispose()
      if (displayOverlay?.parentElement === host) displayOverlay.remove()
      canvas.remove()
    },
  }
}
