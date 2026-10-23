import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/build-guide-navigation.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })
const { legacyBuildGuidePath } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

test('old tool and platform links open the matching combined guide', () => {
  for (const prefix of ['', 'windows-', 'mac-']) {
    assert.equal(legacyBuildGuidePath(`#${prefix}copilot-app`), '/build/app')
    assert.equal(legacyBuildGuidePath(`#${prefix}vscode`), '/build/vscode')
    assert.equal(legacyBuildGuidePath(`#${prefix}copilot-cli`), '/build/cli')
  }
})

test('encoded old guide fragments are recognized', () => {
  assert.equal(legacyBuildGuidePath('#mac%2Dvscode'), '/build/vscode')
  assert.equal(legacyBuildGuidePath('#%63opilot-app'), '/build/app')
})

test('ordinary visits, unknown fragments, and malformed encodings stay on Build', () => {
  for (const fragment of ['', '#', '#local-build-guides', '#other', '#constructor', '#__proto__', '#%E0%A4%A', '#/build/app']) {
    assert.equal(legacyBuildGuidePath(fragment), undefined)
  }
})
