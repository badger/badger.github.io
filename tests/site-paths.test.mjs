import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'

async function compileModule(path, base) {
  const compiled = await build({
    entryPoints: [fileURLToPath(new URL(path, import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    define: { 'import.meta.env.BASE_URL': JSON.stringify(base) },
  })
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
}

for (const base of ['/', '/badger.github.io/']) {
  test(`site URLs respect the deployment base ${base}`, async () => {
    const { sitePath } = await compileModule('../src/lib/site-path.ts', base)
    assert.equal(sitePath('/'), base)
    assert.equal(sitePath('/apps'), `${base}apps`)
    assert.equal(sitePath('/images/mona.gif'), `${base}images/mona.gif`)
    assert.equal(sitePath('/doom/runtime/doom.wasm'), `${base}doom/runtime/doom.wasm`)
    assert.equal(sitePath(`${base}apps`), `${base}apps`)
    for (const url of ['https://github.com/badger/home', '//example.com/image.png', '#hardware', 'data:image/svg+xml,test']) {
      assert.equal(sitePath(url), url)
    }
  })

  test(`Doom fetches manifest, WAD, and manifest artifacts under ${base}`, async () => {
    const { loadDoomRuntime } = await compileModule('../src/lib/doom-runtime.ts', base)
    const manifest = JSON.parse(await readFile(
      new URL('../public/doom/runtime/manifest.json', import.meta.url), 'utf8',
    ))
    const previous = globalThis.fetch
    const requests = []
    globalThis.fetch = async path => {
      requests.push(path)
      if (path === `${base}doom/runtime/manifest.json`) return { ok: true, json: async () => manifest }
      return { ok: false, status: 404 }
    }
    try {
      await assert.rejects(loadDoomRuntime({}, new AbortController().signal), /Required Doom artifact is unavailable/)
      assert.deepEqual(requests, [
        `${base}doom/runtime/manifest.json`,
        `${base}doom/DOOM1.WAD`,
        `${base}doom/runtime/doom.mjs`,
        `${base}doom/runtime/doom.wasm`,
      ])
    } finally {
      globalThis.fetch = previous
    }
  })
}
