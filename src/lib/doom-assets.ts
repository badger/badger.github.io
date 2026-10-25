export const DOOM_SHAREWARE_WAD = {
  name: 'DOOM1.WAD',
  version: '1.9 shareware',
  size: 4_196_020,
  sha256: '1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771',
} as const

export const DOOM_RUNTIME = {
  engine: 'WebSockets Doom (Chocolate Doom port)',
  version: '0.0.1',
  emscripten: '3.1.45',
  sourceRevision: 'a77edfd8bbc7e66b119a49c954f69a8b24e59206',
  sourceUrl: 'https://github.com/Saketh-Chandra/doom-wasm-pwa/tree/a77edfd8bbc7e66b119a49c954f69a8b24e59206',
  adapterVersion: 1,
} as const

export type DoomArtifact = {
  path: string
  size: number
  sha256: string
}

export type DoomRuntimeManifest = {
  schemaVersion: 1
  engine: typeof DOOM_RUNTIME.engine
  engineVersion: typeof DOOM_RUNTIME.version
  upstreamSourceRevision: string
  upstreamSourceUrl: string
  emscriptenVersion: typeof DOOM_RUNTIME.emscripten
  adapterContractVersion: typeof DOOM_RUNTIME.adapterVersion
  license: DoomArtifact
  correspondingSource: DoomArtifact
  javascript: DoomArtifact
  wasm: DoomArtifact
}

export async function sha256Hex(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
}

export async function verifyArtifact(bytes: ArrayBuffer, expected: Pick<DoomArtifact, 'size' | 'sha256'>) {
  if (bytes.byteLength !== expected.size) {
    throw new Error(`Asset size mismatch: expected ${expected.size} bytes, received ${bytes.byteLength}.`)
  }
  const digest = await sha256Hex(bytes)
  if (digest !== expected.sha256) throw new Error(`Asset SHA-256 mismatch: expected ${expected.sha256}, received ${digest}.`)
}

export function validateRuntimeManifest(value: unknown): DoomRuntimeManifest {
  const manifest = value as Partial<DoomRuntimeManifest> | null
  if (!manifest || manifest.schemaVersion !== 1
    || manifest.engine !== DOOM_RUNTIME.engine
    || manifest.engineVersion !== DOOM_RUNTIME.version
    || manifest.emscriptenVersion !== DOOM_RUNTIME.emscripten
    || manifest.adapterContractVersion !== DOOM_RUNTIME.adapterVersion) {
    throw new Error('The Doom runtime manifest does not match the pinned engine contract.')
  }
  const revision = manifest.upstreamSourceRevision
  if (!/^[a-f0-9]{40}$/.test(revision ?? '')
    || revision !== DOOM_RUNTIME.sourceRevision
    || manifest.upstreamSourceUrl !== DOOM_RUNTIME.sourceUrl
    || !manifest.license || !manifest.correspondingSource) {
    throw new Error('The Doom runtime manifest lacks approved provenance and license/source evidence.')
  }
  for (const artifact of [manifest.javascript, manifest.wasm, manifest.license, manifest.correspondingSource]) {
    if (!artifact || typeof artifact.path !== 'string' || !artifact.path.startsWith('/doom/runtime/')
      || !Number.isSafeInteger(artifact.size) || artifact.size! <= 0
      || !/^[a-f0-9]{64}$/.test(artifact.sha256 ?? '')) {
      throw new Error('The Doom runtime manifest contains an invalid artifact record.')
    }
  }
  return manifest as DoomRuntimeManifest
}
