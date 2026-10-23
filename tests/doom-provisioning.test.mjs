import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const prepare = await readFile(new URL('../scripts/prepare-doom-runtime.mjs', import.meta.url), 'utf8')
const contract = await readFile(new URL('../scripts/doom-runtime-contract.mjs', import.meta.url), 'utf8')
const runtimeBuild = await readFile(new URL('../scripts/build-doom-runtime.mjs', import.meta.url), 'utf8')
const deploy = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')
const readme = await readFile(new URL('../public/doom/README.md', import.meta.url), 'utf8')

test('runtime preparation requires a separate approved provenance contract', () => {
  assert.match(prepare, /approved-runtime\.json/)
  assert.doesNotMatch(prepare, /createHash/)
  assert.doesNotMatch(prepare, /engineVersion:\s*'3\.1\.0'/)
  assert.match(contract, /does not match approved SHA-256/)
})

test('runtime preparation rejects artifacts that do not match separate approval hashes', async () => {
  const workspace = resolve(`.test-doom-provenance-${process.pid}`)
  await mkdir(workspace, { recursive: true })
  try {
    const files = {
      javascript: Buffer.from('arbitrary runtime'),
      wasm: Buffer.from('wasm'),
      license: Buffer.from('license'),
      source: Buffer.from('source evidence'),
    }
    const record = (path, bytes) => ({
      path,
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    })
    const approval = {
      schemaVersion: 1,
      engine: 'WebSockets Doom (Chocolate Doom port)',
      engineVersion: '0.0.1',
      upstreamSourceRevision: 'a77edfd8bbc7e66b119a49c954f69a8b24e59206',
      upstreamSourceUrl: 'https://github.com/Saketh-Chandra/doom-wasm-pwa/tree/a77edfd8bbc7e66b119a49c954f69a8b24e59206',
      emscriptenVersion: '3.1.45',
      adapterContractVersion: 1,
      javascript: { ...record('/doom/runtime/doom.mjs', files.javascript), sha256: '0'.repeat(64) },
      wasm: record('/doom/runtime/doom.wasm', files.wasm),
      license: record('/doom/runtime/COPYING.txt', files.license),
      correspondingSource: record('/doom/runtime/SOURCE.md', files.source),
    }
    await Promise.all([
      writeFile(resolve(workspace, 'doom.mjs'), files.javascript),
      writeFile(resolve(workspace, 'doom.wasm'), files.wasm),
      writeFile(resolve(workspace, 'COPYING.txt'), files.license),
      writeFile(resolve(workspace, 'SOURCE.md'), files.source),
      writeFile(resolve(workspace, 'approved-runtime.json'), JSON.stringify(approval)),
    ])
    const result = spawnSync(process.execPath, [
      resolve('scripts/prepare-doom-runtime.mjs'),
      resolve(workspace, 'doom.mjs'),
      resolve(workspace, 'doom.wasm'),
      resolve(workspace, 'approved-runtime.json'),
      resolve(workspace, 'COPYING.txt'),
      resolve(workspace, 'SOURCE.md'),
    ], { cwd: workspace, encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}\n${result.stderr}`, /does not match approved SHA-256/)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('required verification rejects a self-asserted public manifest without separate approval', async () => {
  const workspace = resolve(`.test-doom-verification-${process.pid}`)
  await mkdir(resolve(workspace, 'public/doom/runtime'), { recursive: true })
  try {
    await Promise.all([
      writeFile(resolve(workspace, 'public/doom/DOOM1.WAD'), 'self-asserted wad'),
      writeFile(resolve(workspace, 'public/doom/runtime/manifest.json'), JSON.stringify({ schemaVersion: 1 })),
    ])
    const result = spawnSync(process.execPath, [
      resolve('scripts/verify-doom-assets.mjs'),
      '--require',
    ], { cwd: workspace, encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}\n${result.stderr}`, /Approved runtime metadata is missing or invalid/)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('deployment verifies committed pinned assets before building', () => {
  assert.match(runtimeBuild, /a77edfd8bbc7e66b119a49c954f69a8b24e59206/)
  assert.match(runtimeBuild, /a5a10b9bc2ad755f068e4ed9e3556caa44d82a2d2f50d61139e6f0903c69f87f/)
  assert.match(runtimeBuild, /1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771/)
  assert.match(runtimeBuild, /postMainLoop\(\)/)
  assert.match(runtimeBuild, /preserveDrawingBuffer = true/)
  assert.doesNotMatch(runtimeBuild, /framePump/)
  assert.match(deploy, /Verify Doom runtime and shareware assets[\s\S]*verify:doom-assets -- --require[\s\S]*Build site/)
  assert.doesNotMatch(deploy, /DOOM_RUNTIME_ENABLED|DOOM_WAD_B64|releases\/latest|\/latest(?:\/|$)/)
  assert.match(readme, /committed/)
})
