import { Box3, CanvasTexture, DirectionalLight, DoubleSide, HemisphereLight, LinearFilter, Mesh, MeshBasicMaterial, MeshStandardMaterial, NearestFilter, PerspectiveCamera, Raycaster, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer, type Material, type Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export function initBadgeModel(host: HTMLElement, screen: HTMLCanvasElement, button: (bit: number, pressed: boolean) => void, signal: AbortSignal, onError: (error: unknown) => void) {
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
  canvas.setAttribute('aria-label', 'Interactive 3D badge. Drag to rotate, scroll to zoom. Arrow keys control the badge, Space selects. WASD and J control the gamepad.')
  host.append(canvas)
  const scene = new Scene()
  const camera = new PerspectiveCamera(35, 1, 0.001, 2)
  const controls = new OrbitControls(camera, canvas)
  controls.enablePan = false
  controls.minDistance = 0.025
  controls.maxDistance = 0.6
  scene.add(new HemisphereLight(0xffffff, 0x303050, 2.5))
  const key = new DirectionalLight(0xffffff, 3)
  key.position.set(-0.1, 0.15, 0.3)
  scene.add(key)
  const fill = new DirectionalLight(0xb7a8ff, 1.5)
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
  const resetButton = document.getElementById('reset-badge-view') as HTMLButtonElement
  const screenButton = document.getElementById('focus-badge-screen') as HTMLButtonElement
  const status = document.getElementById('model-status')!
  let model: Object3D | undefined
  let displayMesh: Mesh | undefined
  let active: { pointer: number; bit: number } | undefined
  let mask = 0
  let frame = 0
  let disposed = false
  let screenView = false

  function render() {
    if (disposed || frame || document.hidden) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (disposed) return
      try { renderer.render(scene, camera) } catch (error) { onError(error) }
    })
  }
  function updateFrame() {
    context.fillStyle = '#000'
    context.fillRect(0, 0, display.width, display.height)
    const scale = Math.min(display.width / screen.width, display.height / screen.height)
    context.imageSmoothingEnabled = false
    context.drawImage(screen, (display.width - screen.width * scale) / 2, (display.height - screen.height * scale) / 2, screen.width * scale, screen.height * scale)
    texture.needsUpdate = true
    render()
  }
  function setButtons(value: number) {
    mask = value
    for (const [bit, cap] of caps) {
      const gamepad = ({ 16: 256, 8: 512, 4: 1024, 2: 2048, 1: 4096 } as Record<number, number>)[bit]
      const pressed = Boolean(value & (bit | gamepad))
      cap.mesh.position.z = cap.z - (pressed ? 0.0012 : 0)
      cap.material.emissive.setHex(pressed ? 0x5fed83 : 0)
      cap.material.emissiveIntensity = pressed ? 0.6 : 0
    }
    render()
  }
  function view() {
    if (!model) return
    const bounds = new Box3().setFromObject(screenView && displayMesh ? displayMesh : model)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    const distance = Math.max(size.y, size.x / camera.aspect) / (2 * Math.tan(camera.fov * Math.PI / 360)) * (screenView ? 1.25 : 1.12)
    controls.target.copy(center)
    camera.position.copy(center).add(new Vector3(screenView ? 0 : distance * 0.04, screenView ? 0 : distance * 0.02, distance))
    controls.update()
    render()
  }
  const reset = () => { screenView = false; view() }
  const focusScreen = () => { screenView = true; view() }
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
    return first ? targets.get(first.object) || 0 : 0
  }
  const down = (event: PointerEvent) => {
    canvas.focus({ preventScroll: true })
    if (event.button !== 0 || active) return
    const bit = hit(event)
    if (!bit) return
    event.preventDefault()
    event.stopImmediatePropagation()
    controls.enabled = false
    active = { pointer: event.pointerId, bit }
    canvas.setPointerCapture(event.pointerId)
    button(bit, true)
  }
  const release = () => {
    if (!active) return
    const previous = active
    active = undefined
    button(previous.bit, false)
    controls.enabled = true
    if (canvas.hasPointerCapture(previous.pointer)) canvas.releasePointerCapture(previous.pointer)
  }
  const up = (event: PointerEvent) => {
    if (event.pointerId !== active?.pointer) return
    event.stopImmediatePropagation()
    release()
  }
  const move = (event: PointerEvent) => { canvas.style.cursor = active || hit(event) ? 'pointer' : 'grab' }
  const lost = (event: Event) => {
    event.preventDefault()
    onError(new Error('The browser lost its 3D graphics context.'))
  }
  canvas.addEventListener('pointerdown', down, true)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up, true)
  canvas.addEventListener('pointercancel', up, true)
  canvas.addEventListener('lostpointercapture', release)
  canvas.addEventListener('webglcontextlost', lost)
  window.addEventListener('blur', release)
  document.addEventListener('visibilitychange', release)
  controls.addEventListener('change', render)
  resetButton.addEventListener('click', reset)
  screenButton.addEventListener('click', focusScreen)
  const ready = fetch('/simulator/models/github-mona-badge.glb', { signal }).then(async response => {
    if (!response.ok) throw new Error(`Could not load the badge model (HTTP ${response.status}).`)
    const data = await response.arrayBuffer()
    signal.throwIfAborted()
    return new GLTFLoader().parseAsync(data, '/simulator/models/')
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
      }
      if (materials.some(material => material.transparent)) materials.forEach(material => { material.depthWrite = false })
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
    if (disposed) { disposeModel(); return }
    updateFrame()
    setButtons(mask)
    view()
    renderer.render(scene, camera)
    if (disposed || signal.aborted) return
    host.dataset.state = 'ready'
    status.hidden = true
    resetButton.disabled = screenButton.disabled = false
  })

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
    setBacklight(value: number) { displayMaterial.color.setScalar(Math.max(0, Math.min(1, value))); render() },
    dispose() {
      if (disposed) return
      disposed = true
      release()
      cancelAnimationFrame(frame)
      resize.disconnect()
      controls.dispose()
      resetButton.removeEventListener('click', reset)
      screenButton.removeEventListener('click', focusScreen)
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', release)
      canvas.removeEventListener('webglcontextlost', lost)
      disposeModel()
      displayMaterial.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
