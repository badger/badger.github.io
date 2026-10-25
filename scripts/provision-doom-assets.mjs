import { mkdir, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const secrets = [
  'DOOM_WAD_B64',
  'DOOM_RUNTIME_JS_B64',
  'DOOM_RUNTIME_WASM_B64',
  'DOOM_RUNTIME_APPROVAL_B64',
  'DOOM_RUNTIME_LICENSE_B64',
  'DOOM_RUNTIME_SOURCE_EVIDENCE_B64',
]
const missing = secrets.filter(name => !process.env[name])
if (missing.length) {
  console.error(`Doom runtime provisioning is enabled but required secrets are missing: ${missing.join(', ')}`)
  process.exit(1)
}

function decode(name) {
  const encoded = process.env[name].replace(/\s/g, '')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error(`${name} is not valid base64.`)
  const bytes = Buffer.from(encoded, 'base64')
  if (!bytes.length || bytes.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
    throw new Error(`${name} is empty or not canonical base64.`)
  }
  return bytes
}

const staging = '.doom-provisioning'
try {
  await mkdir(staging, { recursive: true })
  await mkdir('config', { recursive: true })
  const paths = {
    wad: `${staging}/DOOM1.WAD`,
    javascript: `${staging}/doom.mjs`,
    wasm: `${staging}/doom.wasm`,
    approval: 'config/doom-runtime-approved.json',
    license: `${staging}/COPYING.txt`,
    source: `${staging}/SOURCE.md`,
  }
  await Promise.all([
    writeFile(paths.wad, decode('DOOM_WAD_B64'), { mode: 0o600 }),
    writeFile(paths.javascript, decode('DOOM_RUNTIME_JS_B64'), { mode: 0o600 }),
    writeFile(paths.wasm, decode('DOOM_RUNTIME_WASM_B64'), { mode: 0o600 }),
    writeFile(paths.approval, decode('DOOM_RUNTIME_APPROVAL_B64'), { mode: 0o600 }),
    writeFile(paths.license, decode('DOOM_RUNTIME_LICENSE_B64'), { mode: 0o600 }),
    writeFile(paths.source, decode('DOOM_RUNTIME_SOURCE_EVIDENCE_B64'), { mode: 0o600 }),
  ])
  for (const args of [
    ['scripts/prepare-doom-wad.mjs', paths.wad],
    ['scripts/prepare-doom-runtime.mjs', paths.javascript, paths.wasm, paths.approval, paths.license, paths.source],
  ]) {
    const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`Provisioning command failed: ${args[0]}`)
  }
  console.log('Provisioned approved Doom assets from protected base64 secrets.')
} finally {
  await rm(staging, { recursive: true, force: true })
}
