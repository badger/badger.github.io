import { fileURLToPath } from 'node:url'
import { isAbsolute, relative, sep } from 'node:path'

export const simulatorRevision = 'eb3b3fbf27e6e61635aef5de11ab17e6303e8c20'

export function adaptExampleSource(file, source) {
  return file === 'raycast.py' ? source.replace(/^minimap_overlay_len = minimap_overlay.width \* minimap_overlay.height$/m, 'minimap_overlay_len = len(minimap_overlay_mv)') : source
}

export function exampleAssetDestination(asset, staging) {
  if (!asset.startsWith('assets/') || asset.split('/').some(part => !part || part === '..' || part === '.')) throw new Error('Unsafe asset path')
  const destination = new URL(asset, staging)
  const path = relative(fileURLToPath(staging), fileURLToPath(destination))
  if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) throw new Error('Unsafe asset path')
  return destination
}
