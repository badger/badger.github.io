import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { preservePageAssets } from '../scripts/preserve-page-assets.mjs'

test('cached HTML keeps its entry script and imported chunks across deployments', async t => {
  const root = await mkdtemp(join(tmpdir(), 'badger-assets-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const current = join(root, 'current')
  const previous = join(root, 'previous')
  const put = async (directory, path, content) => {
    await mkdir(dirname(join(directory, path)), { recursive: true })
    await writeFile(join(directory, path), content)
  }
  await put(current, 'entry.current.js', 'current')
  await put(current, 'entry.shared.js', 'new shared')
  await put(current, 'simulator/index.html', 'current HTML')
  await put(previous, 'entry.old.js', 'import "./chunks/chunk.old.js"')
  await put(previous, 'entry.shared.js', 'old shared')
  await put(previous, 'chunks/chunk.old.js', 'old chunk')
  await put(previous, 'assets/editor.old.css', 'old CSS')
  await put(previous, 'simulator/index.html', 'old HTML')
  await put(previous, 'secrets.py', 'excluded')
  await preservePageAssets(current, [previous])
  assert.equal(await readFile(join(current, 'entry.old.js'), 'utf8'), 'import "./chunks/chunk.old.js"')
  assert.equal(await readFile(join(current, 'chunks/chunk.old.js'), 'utf8'), 'old chunk')
  assert.equal(await readFile(join(current, 'assets/editor.old.css'), 'utf8'), 'old CSS')
  assert.equal(await readFile(join(current, 'entry.shared.js'), 'utf8'), 'new shared')
  assert.equal(await readFile(join(current, 'simulator/index.html'), 'utf8'), 'current HTML')
  await assert.rejects(readFile(join(current, 'secrets.py')), { code: 'ENOENT' })
  assert.deepEqual(JSON.parse(await readFile(join(current, 'page-assets.json'), 'utf8')), ['entry.current.js', 'entry.shared.js'])
  const next = join(root, 'next')
  await put(next, 'entry.next.js', 'next')
  await preservePageAssets(next, [current])
  assert.equal(await readFile(join(next, 'entry.current.js'), 'utf8'), 'current')
  await assert.rejects(readFile(join(next, 'entry.old.js')), { code: 'ENOENT' })
})
