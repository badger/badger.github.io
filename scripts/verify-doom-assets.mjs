import { access, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { APPROVAL_PATH, digest, readApproval, verifyApprovedFile } from './doom-runtime-contract.mjs'

const required = process.argv.includes('--require')
const root = resolve('public/doom')
const approvalPath = process.env.DOOM_RUNTIME_APPROVAL_PATH || APPROVAL_PATH
const wadExpected = { size: 4_196_020, sha256: '1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771' }
const exists = path => access(path).then(() => true, () => false)
const fail = message => { console.error(message); process.exitCode = 1 }
const wadPath = resolve(root, 'DOOM1.WAD')
const manifestPath = resolve(root, 'runtime/manifest.json')
const installed = await Promise.all([wadPath, manifestPath].map(exists))

if (!installed.some(Boolean)) {
  if (required) fail('Doom runtime is enabled but approved engine artifacts and DOOM1.WAD are missing.')
  else console.log('Doom assets are not installed; /virtual will report the blocker. Development verification passed.')
} else if (!installed.every(Boolean)) {
  fail('Doom asset installation is incomplete: DOOM1.WAD and runtime/manifest.json must be supplied together.')
} else {
  try {
    const approval = await readApproval(approvalPath)
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    if (JSON.stringify(manifest) !== JSON.stringify(approval)) {
      throw new Error('Installed runtime manifest is not the separately maintained approved-runtime metadata.')
    }
    const wad = await readFile(wadPath)
    if (wad.byteLength !== wadExpected.size || digest(wad) !== wadExpected.sha256) {
      throw new Error('DOOM1.WAD is not the exact Doom 1 v1.9 shareware asset.')
    }
    await Promise.all([
      verifyApprovedFile(resolve('public/doom/runtime/doom.mjs'), approval.javascript, 'doom.mjs'),
      verifyApprovedFile(resolve('public/doom/runtime/doom.wasm'), approval.wasm, 'doom.wasm'),
      verifyApprovedFile(resolve('public/doom/runtime/COPYING.txt'), approval.license, 'runtime license'),
      verifyApprovedFile(resolve('public/doom/runtime/SOURCE.md'), approval.correspondingSource, 'corresponding-source evidence'),
    ])
    console.log('Verified approved Chocolate Doom runtime provenance, license/source evidence, and Doom 1 v1.9 shareware WAD.')
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}
