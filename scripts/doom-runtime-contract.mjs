import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

export const APPROVAL_PATH = 'config/doom-runtime-approved.json'
export const ADAPTER_CONTRACT_VERSION = 1
const SOURCE_REVISION = 'a77edfd8bbc7e66b119a49c954f69a8b24e59206'
const SOURCE_URL = `https://github.com/Saketh-Chandra/doom-wasm-pwa/tree/${SOURCE_REVISION}`

const records = {
  javascript: '/doom/runtime/doom.mjs',
  wasm: '/doom/runtime/doom.wasm',
  license: '/doom/runtime/COPYING.txt',
  correspondingSource: '/doom/runtime/SOURCE.md',
}

export const digest = bytes => createHash('sha256').update(bytes).digest('hex')

export function validateApproval(value) {
  const approval = value
  const revision = approval?.upstreamSourceRevision
  if (!approval || approval.schemaVersion !== 1
    || approval.engine !== 'WebSockets Doom (Chocolate Doom port)'
    || approval.engineVersion !== '0.0.1'
    || revision !== SOURCE_REVISION
    || approval.upstreamSourceUrl !== SOURCE_URL
    || approval.emscriptenVersion !== '3.1.45'
    || approval.adapterContractVersion !== ADAPTER_CONTRACT_VERSION) {
    throw new Error('Approved runtime metadata does not satisfy the pinned provenance contract.')
  }
  for (const [name, path] of Object.entries(records)) {
    const artifact = approval[name]
    if (!artifact || artifact.path !== path || !Number.isSafeInteger(artifact.size) || artifact.size <= 0
      || !/^[a-f0-9]{64}$/.test(artifact.sha256 ?? '')) {
      throw new Error(`Approved runtime metadata has an invalid ${name} record.`)
    }
  }
  return approval
}

export async function readApproval(path = APPROVAL_PATH) {
  let value
  try {
    value = JSON.parse(await readFile(path, 'utf8'))
  } catch {
    throw new Error(`Approved runtime metadata is missing or invalid: ${path}`)
  }
  return validateApproval(value)
}

export async function verifyApprovedFile(path, expected, label) {
  const bytes = await readFile(path)
  const sha256 = digest(bytes)
  if (bytes.byteLength !== expected.size) {
    throw new Error(`${label} does not match approved size: expected ${expected.size}, received ${bytes.byteLength}.`)
  }
  if (sha256 !== expected.sha256) {
    throw new Error(`${label} does not match approved SHA-256: expected ${expected.sha256}, received ${sha256}.`)
  }
  return bytes
}
