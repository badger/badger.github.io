import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { adaptExampleSource, exampleAssetDestination, simulatorRevision } from '../scripts/editor-example-source.mjs'

test('example assets cannot escape staging through literal or encoded traversal', () => {
  const staging = new URL('file:///tmp/example-staging/')
  for (const asset of ['assets/../../x', 'assets/%2e%2e/%2e%2e/x', 'assets/.%2E/%2E./x', 'assets/%2f../../x', 'assets/..\\..\\x', '/tmp/x', 'https://example.com/x', 'assets//x']) {
    assert.throws(() => exampleAssetDestination(asset, staging), undefined, asset)
  }
  assert.equal(exampleAssetDestination('assets/fonts/hello.ppf', staging).href, 'file:///tmp/example-staging/assets/fonts/hello.ppf')
})

test('example syncing uses the runtime revision and retains the full RGBA minimap clear', async () => {
  const catalog = JSON.parse(await readFile(new URL('../public/editor-examples/catalog.json', import.meta.url)))
  const provenance = await readFile(new URL('../public/simulator/THIRD_PARTY.md', import.meta.url), 'utf8')
  assert.equal(simulatorRevision, catalog.revision)
  assert.ok(provenance.includes(`/tree/${simulatorRevision}`))
  const original = 'minimap_overlay_len = minimap_overlay.width * minimap_overlay.height\n'
  assert.equal(adaptExampleSource('raycast.py', original), 'minimap_overlay_len = len(minimap_overlay_mv)\n')
  assert.equal(adaptExampleSource('other.py', original), original)
})
