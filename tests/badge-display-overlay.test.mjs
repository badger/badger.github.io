import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { Group, Matrix4, Mesh, PerspectiveCamera, PlaneGeometry, Vector3 } from 'three'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/badge-display-overlay.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { displayOverlayMatrix } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

test('video corners match the projected display at compositor float precision', () => {
  const screen = new Mesh(new PlaneGeometry(0.0499, 0.0341).translate(0, -0.0431, 0.00322))
  screen.geometry.computeBoundingBox()
  const bounds = screen.geometry.boundingBox
  const model = new Group()
  model.add(screen)
  for (const rotated of [false, true]) {
    model.rotation.z = rotated ? Math.PI : 0
    model.updateMatrixWorld(true)
    const center = bounds.getCenter(new Vector3()).applyMatrix4(screen.matrixWorld)
    for (const [width, height] of [[1048, 740], [390, 540]]) {
      for (const offset of [new Vector3(0, 0, 0.075), new Vector3(0.02, 0.01, 0.1), new Vector3(-0.015, -0.01, 0.04)]) {
        const camera = new PerspectiveCamera(35, width / height, 0.001, 2)
        camera.position.copy(center).add(offset)
        camera.lookAt(center)
        camera.updateMatrixWorld(true)
        const matrix = displayOverlayMatrix(screen, camera, width, height, rotated)
        assert.ok(matrix)
        const compositor = new Matrix4().fromArray(new Float32Array(matrix.elements))
        for (const [x, y] of [[0, 0], [640, 0], [640, 438], [0, 438]]) {
          const projected = new Vector3(
            (rotated ? bounds.max.x : bounds.min.x) + (rotated ? -1 : 1) * x / 640 * (bounds.max.x - bounds.min.x),
            (rotated ? bounds.min.y : bounds.max.y) + (rotated ? 1 : -1) * y / 438 * (bounds.max.y - bounds.min.y),
            bounds.max.z,
          ).applyMatrix4(screen.matrixWorld).project(camera)
          const actual = new Vector3(x, y, 0).applyMatrix4(compositor)
          assert.ok(Math.abs(actual.x - (projected.x + 1) * width / 2) < 0.001)
          assert.ok(Math.abs(actual.y - (1 - projected.y) * height / 2) < 0.001)
        }
      }
    }
  }
})

test('video does not float above the back of the badge', () => {
  const screen = new Mesh(new PlaneGeometry(0.05, 0.034))
  screen.geometry.computeBoundingBox()
  screen.updateMatrixWorld(true)
  const camera = new PerspectiveCamera(35, 1, 0.001, 2)
  camera.position.z = -0.1
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  assert.equal(displayOverlayMatrix(screen, camera, 600, 600, false), null)
})
