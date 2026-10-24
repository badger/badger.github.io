import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/doom-assets.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })
const { DOOM_RUNTIME, DOOM_SHAREWARE_WAD, validateRuntimeManifest, verifyArtifact } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

test('pins the exact Doom 1 v1.9 shareware WAD identity', () => {
  assert.deepEqual(DOOM_SHAREWARE_WAD, {
    name: 'DOOM1.WAD',
    version: '1.9 shareware',
    size: 4_196_020,
    sha256: '1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771',
  })
})

test('asset verification requires both exact size and SHA-256', async () => {
  const bytes = new TextEncoder().encode('doom').buffer
  await assert.rejects(verifyArtifact(bytes, { size: 5, sha256: '0'.repeat(64) }), /size mismatch/)
  await assert.rejects(verifyArtifact(bytes, { size: 4, sha256: '0'.repeat(64) }), /SHA-256 mismatch/)
})

test('runtime manifest accepts only independently approved provenance and strict artifact records', () => {
  const artifact = { path: '/doom/runtime/doom.mjs', size: 1, sha256: 'a'.repeat(64) }
  const manifest = {
    schemaVersion: 1,
    engine: DOOM_RUNTIME.engine,
    engineVersion: DOOM_RUNTIME.version,
    upstreamSourceRevision: DOOM_RUNTIME.sourceRevision,
    upstreamSourceUrl: DOOM_RUNTIME.sourceUrl,
    emscriptenVersion: DOOM_RUNTIME.emscripten,
    adapterContractVersion: DOOM_RUNTIME.adapterVersion,
    license: { ...artifact, path: '/doom/runtime/COPYING.txt' },
    correspondingSource: { ...artifact, path: '/doom/runtime/SOURCE.md' },
    javascript: artifact,
    wasm: { ...artifact, path: '/doom/runtime/doom.wasm' },
  }
  assert.equal(validateRuntimeManifest(manifest), manifest)
  assert.throws(() => validateRuntimeManifest({ ...manifest, engineVersion: 'latest' }), /pinned engine contract/)
  assert.throws(() => validateRuntimeManifest({ ...manifest, upstreamSourceRevision: 'self-asserted' }), /approved provenance/)
  assert.throws(() => validateRuntimeManifest({ ...manifest, license: undefined }), /approved provenance/)
  assert.throws(() => validateRuntimeManifest({ ...manifest, wasm: { ...artifact, path: 'https://example.com/doom.wasm' } }), /invalid artifact/)
})
