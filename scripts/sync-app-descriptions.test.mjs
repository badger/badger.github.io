import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { getInstallableAppFolders } from '../src/lib/github-app-catalog.ts'
import { CATALOG_ENDPOINT, SOURCE_ENDPOINT, syncAppDescriptions, validateDescriptions } from './sync-app-descriptions.mjs'

function catalog(...names) {
  return {
    truncated: false,
    tree: names.map((name) => ({ path: `badge/apps/${name}/__init__.py`, type: 'blob' })),
  }
}

test('sorts exact folder keys and accepts factory-only entries', () => {
  const descriptions = {
    sketchy_sketch: 'Draw with the directional controls.',
    commits: 'Break bricks with a paddle.',
    flappy: 'Guide Mona past obstacles.',
    sketch: 'Draw in the factory app.',
  }
  const validated = validateDescriptions(descriptions, catalog('flappy', 'commits', 'sketchy_sketch'))
  assert.deepEqual(Object.keys(validated), ['commits', 'flappy', 'sketch', 'sketchy_sketch'])
  assert.equal(validated.sketch, descriptions.sketch)
  assert.equal(validated.sketchy_sketch, descriptions.sketchy_sketch)
})

test('does not match content slugs or similar folder names', () => {
  assert.throws(() => validateDescriptions({
    flappymona: 'A game.', sketch: 'A drawing app.',
  }, catalog('flappy', 'sketchy_sketch')), /flappy, sketchy_sketch/)
})

test('rejects invalid description document shapes', () => {
  for (const value of [null, [], 'text', 42, true]) {
    assert.throws(() => validateDescriptions(value, catalog('flappy')), /JSON object/)
  }
})

test('rejects blank, untrimmed, multiline, control-character, and non-string descriptions', () => {
  for (const value of ['', ' ', ' text', 'text ', 'two\nlines', 'text\u0000', null, 3, {}, []]) {
    assert.throws(() => validateDescriptions({ flappy: value }, catalog('flappy')), /Invalid description entries: flappy/)
  }
})

test('rejects unsafe and system folder keys, even when they are extra entries', () => {
  for (const name of ['../flappy', 'a/b', '__proto__', 'constructor', 'prototype', 'menu', 'startup', 'Bad Name']) {
    assert.throws(() => validateDescriptions(
      Object.fromEntries([['flappy', 'A game.'], [name, 'Invalid app.']]),
      catalog('flappy'),
    ), /Invalid description entries/)
  }
})

test('rejects malformed, truncated, and empty catalog responses', () => {
  for (const value of [null, {}, { tree: [] }, { truncated: true, tree: [] },
    { truncated: false, tree: [null] }, { truncated: false, tree: [{ path: 1, type: 'blob' }] },
    { truncated: false, tree: [{ path: 'badge/apps/flappy/__init__.py' }] }]) {
    assert.throws(() => validateDescriptions({ flappy: 'A game.' }, value), /complete, valid GitHub file tree/)
  }
  assert.throws(() => validateDescriptions({}, catalog()), /no installable apps/)
})

test('uses the store rules for system apps, non-app files, and cached files', () => {
  const tree = catalog('flappy', 'menu', 'startup')
  tree.tree.push(
    { path: 'badge/apps/docs/README.md', type: 'blob' },
    { path: 'badge/apps/cached/__pycache__/__init__.py', type: 'blob' },
    { path: 'elsewhere/app/__init__.py', type: 'blob' },
  )
  assert.deepEqual(validateDescriptions({ flappy: 'A game.' }, tree), { flappy: 'A game.' })
})

test('excludes quest from both the store list and description coverage', () => {
  const tree = catalog('flappy', 'quest', 'menu', 'startup')
  assert.deepEqual(getInstallableAppFolders(tree.tree), [['flappy', ['__init__.py']]])
  assert.deepEqual(validateDescriptions({ flappy: 'A game.' }, tree), { flappy: 'A game.' })
})

async function temporaryOutput(t) {
  const directory = await mkdtemp(join(tmpdir(), 'badger-descriptions-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return { directory, outputPath: join(directory, 'app-descriptions.json') }
}

function reader(source, tree) {
  return async (endpoint) => {
    if (endpoint === SOURCE_ENDPOINT) return source
    assert.equal(endpoint, CATALOG_ENDPOINT)
    return tree
  }
}

test('writes sorted JSON and does not rewrite an unchanged copy', async (t) => {
  const { directory, outputPath } = await temporaryOutput(t)
  const options = {
    outputPath,
    readGitHub: reader({ flappy: 'A game.', commits: 'Break bricks.' }, catalog('flappy', 'commits')),
  }
  assert.deepEqual(await syncAppDescriptions(options), { changed: true, count: 2 })
  assert.equal(await readFile(outputPath, 'utf8'), '{\n  "commits": "Break bricks.",\n  "flappy": "A game."\n}\n')
  const before = await stat(outputPath)
  assert.deepEqual(await syncAppDescriptions(options), { changed: false, count: 2 })
  assert.equal((await stat(outputPath)).mtimeMs, before.mtimeMs)
  assert.deepEqual(await readdir(directory), ['app-descriptions.json'])
})

test('failed downloads and validation preserve the last good copy', async (t) => {
  const { directory, outputPath } = await temporaryOutput(t)
  const previous = '{"flappy":"Last good copy."}\n'
  await writeFile(outputPath, previous)
  for (const endpoint of [SOURCE_ENDPOINT, CATALOG_ENDPOINT]) {
    await assert.rejects(syncAppDescriptions({
      outputPath,
      readGitHub: async (requested) => {
        if (requested === endpoint) throw new Error('Download failed')
        return requested === SOURCE_ENDPOINT ? { flappy: 'A game.' } : catalog('flappy')
      },
    }), /Download failed/)
    assert.equal(await readFile(outputPath, 'utf8'), previous)
  }
  await assert.rejects(syncAppDescriptions({
    outputPath,
    readGitHub: reader({ flappy: 'A game.' }, catalog('flappy', 'commits')),
  }), /Missing descriptions.*commits/)
  assert.equal(await readFile(outputPath, 'utf8'), previous)
  assert.deepEqual(await readdir(directory), ['app-descriptions.json'])
})
