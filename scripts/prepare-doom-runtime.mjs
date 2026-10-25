import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { readApproval, verifyApprovedFile } from './doom-runtime-contract.mjs'

const [javascriptSource, wasmSource, approvalSource, licenseSource, correspondingSource] = process.argv.slice(2)
if (!javascriptSource || !wasmSource || !approvalSource || !licenseSource || !correspondingSource) {
  console.error('Usage: npm run prepare:doom-runtime -- /path/to/doom.mjs /path/to/doom.wasm /path/to/approved-runtime.json /path/to/COPYING.txt /path/to/SOURCE.md')
  process.exit(2)
}
if (basename(javascriptSource) !== 'doom.mjs' || basename(wasmSource) !== 'doom.wasm') {
  console.error('Runtime outputs must be named doom.mjs and doom.wasm.')
  process.exit(1)
}
const approval = await readApproval(resolve(approvalSource))
await Promise.all([
  verifyApprovedFile(resolve(javascriptSource), approval.javascript, 'doom.mjs'),
  verifyApprovedFile(resolve(wasmSource), approval.wasm, 'doom.wasm'),
  verifyApprovedFile(resolve(licenseSource), approval.license, 'runtime license'),
  verifyApprovedFile(resolve(correspondingSource), approval.correspondingSource, 'corresponding-source evidence'),
])
await mkdir('public/doom/runtime', { recursive: true })
await Promise.all([
  copyFile(resolve(javascriptSource), 'public/doom/runtime/doom.mjs'),
  copyFile(resolve(wasmSource), 'public/doom/runtime/doom.wasm'),
  copyFile(resolve(licenseSource), 'public/doom/runtime/COPYING.txt'),
  copyFile(resolve(correspondingSource), 'public/doom/runtime/SOURCE.md'),
  writeFile('public/doom/runtime/manifest.json', `${JSON.stringify(approval, null, 2)}\n`),
])
console.log('Installed runtime artifacts that match the separately approved provenance contract.')
