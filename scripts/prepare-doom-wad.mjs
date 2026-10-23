import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const expected = {
  size: 4_196_020,
  sha256: '1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771',
}
const source = process.argv[2]
if (!source) {
  console.error('Usage: npm run prepare:doom-wad -- /absolute/path/to/DOOM1.WAD')
  process.exit(2)
}
const bytes = await readFile(resolve(source))
const sha256 = createHash('sha256').update(bytes).digest('hex')
if (bytes.byteLength !== expected.size || sha256 !== expected.sha256) {
  console.error(`Rejected WAD: expected ${expected.size} bytes and SHA-256 ${expected.sha256}; received ${bytes.byteLength} bytes and ${sha256}.`)
  process.exit(1)
}
await mkdir('public/doom', { recursive: true })
await copyFile(resolve(source), 'public/doom/DOOM1.WAD')
console.log('Installed verified Doom 1 v1.9 shareware DOOM1.WAD at public/doom/DOOM1.WAD.')
