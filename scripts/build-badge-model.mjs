// Rebuilds public/simulator/models/github-mona-badge.glb from the H4X0R3D source model,
// replacing its approximate clear lower shell with tessellated Badgeware case CAD geometry
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { getBounds, prune } from '@gltf-transform/functions'
import occtimportjs from 'occt-import-js'

const SOURCE = 'https://leereilly.net/h4x0r3d-badge/models/github_mona_badge_screen_centered.glb'
const OUTPUT = fileURLToPath(new URL('../public/simulator/models/github-mona-badge.glb', import.meta.url))
const SHELL = 'Clear molded shell smooth radiused corners'
const PCB = 'Upper FR4 badge PCB with cut-through lanyard slots'
const BUTTONS = ['left', 'middle', 'right', 'up', 'down']
const USB = ['USB-C outer housing', 'USB-C socket dark']
// The source maps rear artwork with the front's UVs, so it reads mirrored from behind.
const REAR_ARTWORK = ['Rear printed board and sponsorship artwork', 'Back electronics silkscreen print']

const [stepPath, sourcePath] = process.argv.slice(2)
if (!stepPath) {
  console.error('Usage: npm run build:badge-model -- <Badgeware_Solid.step> [source.glb]')
  process.exit(1)
}

const io = new NodeIO()
const source = sourcePath ? await fs.readFile(sourcePath) : new Uint8Array(await (await fetch(SOURCE)).arrayBuffer())
if (new TextDecoder().decode(source.subarray(0, 4)) !== 'glTF') throw new Error(`Source is not a GLB. Download ${SOURCE} and pass its path.`)
const doc = await io.readBinary(new Uint8Array(source))
const nodes = new Map(doc.getRoot().listNodes().map(node => [node.getName(), node]))
const node = name => {
  const found = nodes.get(name)
  if (!found) throw new Error(`Source model is missing "${name}".`)
  return found
}
const center = bounds => [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[1] + bounds.max[1]) / 2]

const occt = await occtimportjs()
const step = occt.ReadStepFile(new Uint8Array(await fs.readFile(stepPath)), { linearUnit: 'millimeter', linearDeflectionType: 'absolute_value', linearDeflection: 0.05, angularDeflection: 0.15 })
if (!step.success || step.meshes.length !== 1) throw new Error('Expected one solid in the STEP file.')
const mesh = step.meshes[0]
const position = mesh.attributes.position.array
const normal = mesh.attributes.normal.array
const index = mesh.index.array
const count = position.length / 3
const at = (i, axis) => position[i * 3 + axis]

// STEP axes: X across the badge, +Y out of the front face, +Z down towards the A/B/C buttons.
// Model axes: X across, +Y up, +Z out of the front face, in metres.
let front = -Infinity, tabEnd = Infinity
for (let i = 0; i < count; i++) { front = Math.max(front, at(i, 1)); tabEnd = Math.min(tabEnd, at(i, 2)) }

// The case exports with a stub of the upper PCB in its slot: the B-rep faces that lie within the
// stub's thickness and reach past the case body. Measure it to match the model's PCB, then drop it.
let tabHalf = 0
for (let i = 0; i < count; i++) if (at(i, 2) < tabEnd + 1) tabHalf = Math.max(tabHalf, Math.abs(at(i, 1)))
let bodyTop = Infinity
for (let i = 0; i < count; i++) if (Math.abs(at(i, 1)) > tabHalf + 0.01) bodyTop = Math.min(bodyTop, at(i, 2))
const tabFaces = mesh.brep_faces.filter(face => {
  let reaches = false
  for (let t = face.first * 3; t < (face.last + 1) * 3; t++) {
    if (Math.abs(at(index[t], 1)) > tabHalf + 0.01) return false
    if (at(index[t], 2) < bodyTop) reaches = true
  }
  return reaches
})
const inTab = t => tabFaces.some(face => t >= face.first && t <= face.last)
let tabMin = Infinity, tabMax = -Infinity
for (const face of tabFaces) for (let t = face.first * 3; t < (face.last + 1) * 3; t++) {
  tabMin = Math.min(tabMin, at(index[t], 0))
  tabMax = Math.max(tabMax, at(index[t], 0))
}
const pcb = getBounds(node(PCB))
// Metres per STEP millimetre.
const scale = (pcb.max[0] - pcb.min[0]) / (tabMax - tabMin)

// Button nubs are the front-most faces of the case.
const nubs = []
for (let i = 0; i < count; i++) {
  if (at(i, 1) < front - 0.05) continue
  const x = at(i, 0), z = at(i, 2)
  let nub = nubs.find(nub => Math.hypot(nub.seed[0] - x, nub.seed[1] - z) < 10.5)
  if (!nub) nubs.push(nub = { seed: [x, z], min: [x, z], max: [x, z] })
  nub.min = [Math.min(nub.min[0], x), Math.min(nub.min[1], z)]
  nub.max = [Math.max(nub.max[0], x), Math.max(nub.max[1], z)]
}
if (nubs.length !== 5) throw new Error(`Expected 5 button nubs in the case, found ${nubs.length}.`)
const nubCenters = nubs.map(nub => [(nub.min[0] + nub.max[0]) / 2, (nub.min[1] + nub.max[1]) / 2]).sort((a, b) => b[1] - a[1])
const bottomRow = nubCenters.slice(0, 3).sort((a, b) => a[0] - b[0])
const side = nubCenters.slice(3).sort((a, b) => a[1] - b[1])
const nubFor = { left: bottomRow[0], middle: bottomRow[1], right: bottomRow[2], up: side[0], down: side[1] }

// Align the case so its A/B/C row sits on the model's A/B/C row.
const rowY = BUTTONS.slice(0, 3).reduce((sum, name) => sum + center(getBounds(node(`Black tactile control ${name}`)))[1], 0) / 3
const offsetY = rowY + bottomRow[0][1] * scale
const map = (x, z) => [x * scale, -z * scale + offsetY]

// Drop the PCB stub so the model's own PCB enters the case slot.
const keep = []
for (let t = 0; t < index.length; t += 3) if (!inTab(t / 3)) keep.push(index[t], index[t + 1], index[t + 2])
const remap = new Int32Array(count).fill(-1)
const positions = [], normals = []
for (const i of keep) {
  if (remap[i] >= 0) continue
  remap[i] = positions.length / 3
  const [x, y] = map(at(i, 0), at(i, 2))
  positions.push(x, y, at(i, 1) * scale)
  normals.push(normal[i * 3], -normal[i * 3 + 2], normal[i * 3 + 1])
}
const indices = keep.map(i => remap[i])

const buffer = doc.getRoot().listBuffers()[0]
const shell = node(SHELL)
shell.setName('Clear molded case from Badgeware CAD')
const primitive = shell.getMesh().listPrimitives()[0]
for (const semantic of primitive.listSemantics()) primitive.setAttribute(semantic, null)
primitive
  .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer))
  .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(normals)).setBuffer(buffer))
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(positions.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)).setBuffer(buffer))

const moveTo = (names, [x, y], axes = [true, true]) => {
  const [cx, cy] = center(getBounds(node(names[0])))
  for (const name of names) {
    const [tx, ty, tz] = node(name).getTranslation()
    node(name).setTranslation([tx + (axes[0] ? x - cx : 0), ty + (axes[1] ? y - cy : 0), tz])
  }
}
for (const name of BUTTONS) moveTo([`Black tactile control ${name}`, `Metal button collar ${name}`], map(...nubFor[name]))
for (const name of USB) node(name).dispose()

for (const name of REAR_ARTWORK) {
  const primitive = node(name).getMesh().listPrimitives()[0]
  const array = primitive.getAttribute('TEXCOORD_0').getArray().slice()
  for (let i = 0; i < array.length; i += 2) array[i] = 1 - array[i]
  primitive.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(array).setBuffer(buffer))
}

await doc.transform(prune())
await fs.writeFile(OUTPUT, await io.writeBinary(doc))
console.log(`Wrote ${OUTPUT}: case ${indices.length / 3} triangles, ${tabFaces.length} slot faces removed, ${(scale * 1000).toFixed(4)} mm per CAD mm`)
