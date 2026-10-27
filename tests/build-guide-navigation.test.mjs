import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

for (const base of ['/', '/badger.github.io/']) {
  const compiled = await build({
    entryPoints: [fileURLToPath(new URL('../src/lib/build-guide-navigation.ts', import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    define: { 'import.meta.env.BASE_URL': JSON.stringify(base) },
  })
  const { legacyBuildGuidePath } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

  test(`old tool and platform links open the matching combined guide under ${base}`, () => {
    for (const prefix of ['', 'windows-', 'mac-']) {
      assert.equal(legacyBuildGuidePath(`#${prefix}copilot-app`), `${base}build/app`)
      assert.equal(legacyBuildGuidePath(`#${prefix}vscode`), `${base}build/vscode`)
      assert.equal(legacyBuildGuidePath(`#${prefix}copilot-cli`), `${base}build/cli`)
    }
  })

  test(`encoded old guide fragments are recognized under ${base}`, () => {
    assert.equal(legacyBuildGuidePath('#mac%2Dvscode'), `${base}build/vscode`)
    assert.equal(legacyBuildGuidePath('#%63opilot-app'), `${base}build/app`)
  })

  test(`ordinary visits, unknown fragments, and malformed encodings stay on Build under ${base}`, () => {
    for (const fragment of ['', '#', '#local-build-guides', '#other', '#constructor', '#__proto__', '#%E0%A4%A', '#/build/app']) {
      assert.equal(legacyBuildGuidePath(fragment), undefined)
    }
  })
}
