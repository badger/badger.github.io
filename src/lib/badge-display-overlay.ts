import { Matrix4, Vector3, type Mesh, type PerspectiveCamera } from 'three'

export function displayOverlayMatrix(mesh: Mesh, camera: PerspectiveCamera, width: number, height: number, rotated: boolean) {
  const bounds = mesh.geometry.boundingBox!
  const eye = camera.getWorldPosition(new Vector3()).applyMatrix4(mesh.matrixWorld.clone().invert())
  if (eye.z <= bounds.max.z) return null
  const size = bounds.getSize(new Vector3())
  const direction = rotated ? -1 : 1
  const local = new Matrix4().set(
    direction * size.x / 640, 0, 0, rotated ? bounds.max.x : bounds.min.x,
    0, -direction * size.y / 438, 0, rotated ? bounds.min.y : bounds.max.y,
    0, 0, 1, bounds.max.z,
    0, 0, 0, 1,
  )
  const matrix = new Matrix4().set(
    width / 2, 0, 0, width / 2,
    0, -height / 2, 0, height / 2,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse).multiply(mesh.matrixWorld).multiply(local)
  const values = matrix.elements
  const w = values[3] * 320 + values[7] * 219 + values[15]
  if (w <= 0) return null
  // Project into CSS pixels before compositing; metre-scale CSS-3D transforms lose precision.
  matrix.multiplyScalar(1 / w)
  values[2] = values[6] = values[8] = values[9] = values[11] = values[14] = 0
  values[10] = 1
  return matrix
}
