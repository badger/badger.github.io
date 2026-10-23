import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { build } from 'esbuild'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/doom-aliases.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { doomAliasDestination } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

test('Doom aliases cover every casing without replacing the canonical route or asset paths', () => {
  const aliases = ['doom', 'doom3d', 'd00m3d', 'virtual'].flatMap(route =>
    [...route].reduce((variants, character) => variants.flatMap(prefix =>
      [...new Set([character.toLowerCase(), character.toUpperCase()])].map(letter => prefix + letter)
    ), [''])
  ).filter(alias => alias !== 'virtual')
  for (const base of ['/', '/badger.github.io/']) {
    for (const alias of aliases) {
      assert.equal(doomAliasDestination(`${base}${alias}`, base), `${base}virtual/`)
      assert.equal(doomAliasDestination(`${base}${alias}/`, base), `${base}virtual/`)
    }
    for (const path of ['doom/runtime/doom.wasm', 'doom/DOOM1.WAD', 'virtual', 'virtual/', 'other', 'doom3d/extra']) {
      assert.equal(doomAliasDestination(`${base}${path}`, base), null)
    }
  }
  assert.equal(doomAliasDestination('/DOOM/', '/badger.github.io/'), null)
})
