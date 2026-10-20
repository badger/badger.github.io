import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { adaptExampleSource, exampleAssetDestination, simulatorRevision } from '../scripts/editor-example-source.mjs'

test('example assets cannot escape staging through literal or encoded traversal', () => {
  const staging = new URL('file:///tmp/example-staging/')
  for (const asset of ['assets/../../x', 'assets/%2e%2e/%2e%2e/x', 'assets/.%2E/%2E./x', 'assets/%2e%2e/x', 'assets/%2f../../x', 'assets/..\\..\\x', '/tmp/x', 'https://example.com/x', 'assets//x']) {
    assert.throws(() => exampleAssetDestination(asset, staging), undefined, asset)
  }
  assert.equal(exampleAssetDestination('assets/fonts/hello.ppf', staging).href, 'file:///tmp/example-staging/assets/fonts/hello.ppf')
})

test('the sync command rejects encoded traversal before fetching or writing the escaped asset', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'editor-example-sync-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, 'scripts'))
  await mkdir(join(directory, 'public/editor-examples'), { recursive: true })
  for (const file of ['sync-editor-examples.mjs', 'editor-example-source.mjs']) await copyFile(new URL(`../scripts/${file}`, import.meta.url), join(directory, 'scripts', file))
  const sentinel = join(directory, 'public/x')
  const catalog = join(directory, 'public/editor-examples/catalog.json')
  await writeFile(sentinel, 'keep repository file')
  await writeFile(catalog, 'keep bundled catalog')
  const requests = []
  t.mock.method(globalThis, 'fetch', async url => {
    requests.push(url)
    if (url.endsWith('/manifest.json')) return Response.json({ categories: [{ name: 'Test', examples: [{ file: 'test.py' }] }] })
    if (url.endsWith('/test.py')) return new Response('image.load("/system/assets/%2e%2e/%2e%2e/x")')
    throw new Error('Unexpected request')
  })
  await assert.rejects(import(pathToFileURL(join(directory, 'scripts/sync-editor-examples.mjs')).href), /Unsafe asset path/)
  assert.equal(await readFile(sentinel, 'utf8'), 'keep repository file')
  assert.equal(await readFile(catalog, 'utf8'), 'keep bundled catalog')
  assert.equal(requests.length, 2)
  assert.ok(requests.every(url => url.startsWith(`https://raw.githubusercontent.com/pimoroni/badgeware-web-simulator/${simulatorRevision}/`)))
  await assert.rejects(readFile(join(directory, 'public/.editor-examples-staging/test.py')), { code: 'ENOENT' })
})

test('example syncing uses the runtime revision and retains the full RGBA minimap clear', async () => {
  const catalog = JSON.parse(await readFile(new URL('../public/editor-examples/catalog.json', import.meta.url)))
  const provenance = await readFile(new URL('../public/simulator/THIRD_PARTY.md', import.meta.url), 'utf8')
  assert.equal(simulatorRevision, catalog.revision)
  assert.ok(provenance.includes(`/tree/${simulatorRevision}`))
  const original = 'minimap_overlay_len = minimap_overlay.width * minimap_overlay.height\n'
  assert.equal(adaptExampleSource('raycast.py', original), 'minimap_overlay_len = len(minimap_overlay_mv)\n')
  assert.equal(adaptExampleSource('other.py', original), original)
  assert.throws(() => adaptExampleSource('text.py', 'screen.font = font.compass\n'), /changed upstream/)
})

test('synced text examples use only the badge firmware text API', async () => {
  for (const file of ['text.py', 'vector_text.py']) {
    const source = await readFile(new URL(`../public/editor-examples/${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /text\.(tokenise|draw)\(|rom_font/, file)
    assert.match(source, /add_glyph\(glyph_name, renderer\)/, file)
    assert.match(source, /screen\.text\(message, bounds/, file)
  }
})
