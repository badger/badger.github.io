import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const script = fileURLToPath(new URL('../scripts/verify-site-paths.mjs', import.meta.url))

async function verifyFixture(t, base, origin, imageURL, includeImage = true) {
  const cwd = await mkdtemp(join(tmpdir(), 'badger-site-paths-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  await mkdir(join(cwd, 'dist/images'), { recursive: true })
  await writeFile(join(cwd, 'dist/index.html'), `<meta property="og:image" content="${imageURL}">`)
  if (includeImage) await writeFile(join(cwd, 'dist/images/d00m3d-og.png'), 'image')
  return spawnSync(process.execPath, [script, base, origin], { cwd, encoding: 'utf8' })
}

for (const [base, origin] of [
  ['/', 'https://badger.github.io'],
  ['/badger.github.io/', 'https://example.github.io'],
]) {
  test(`built sharing image uses the deployment origin and base ${origin}${base}`, async t => {
    const result = await verifyFixture(t, base, origin, `${origin}${base}images/d00m3d-og.png`)
    assert.equal(result.status, 0, result.stderr)
  })
}

test('built sharing image rejects a fork origin on the production site', async t => {
  const result = await verifyFixture(t, '/', 'https://badger.github.io',
    'https://example.github.io/badger.github.io/images/d00m3d-og.png')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /og:image.*origin/)
})

test('built sharing image rejects a path outside the deployment base', async t => {
  const result = await verifyFixture(t, '/badger.github.io/', 'https://example.github.io',
    'https://example.github.io/images/d00m3d-og.png')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /og:image.*escapes/)
})

test('built sharing image must be absolute', async t => {
  const result = await verifyFixture(t, '/', 'https://badger.github.io', '/images/d00m3d-og.png')
  assert.notEqual(result.status, 0)
})

test('built sharing image must exist in the deployment artifact', async t => {
  const result = await verifyFixture(t, '/', 'https://badger.github.io',
    'https://badger.github.io/images/d00m3d-og.png', false)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /ENOENT/)
})
