import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { appFileUrl, fetchAppCatalog, validateAppCatalog } from '../src/lib/github-app-catalog.ts'
import { syncAppCatalog } from './sync-app-catalog.mjs'

const exec = promisify(execFile)
const published = () => ({
  revision: 'a'.repeat(40),
  apps: [{ name: 'snake', files: ['__init__.py', 'icon.png'], description: 'Play Snake!' }],
})

async function fixture(t, files) {
  const directory = await mkdtemp(join(tmpdir(), 'badger-app-catalog-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const sourcePath = join(directory, 'home')
  await mkdir(sourcePath)
  const git = async (...args) => (await exec('git', args, { cwd: sourcePath })).stdout.trim()
  await git('init', '-q', '--initial-branch=catalog-test')
  const write = async (path, contents) => {
    const target = join(sourcePath, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, contents)
  }
  const commit = async () => {
    await git('add', '.')
    await git('-c', 'user.name=Catalog Tests', '-c', 'user.email=catalog-tests@example.invalid',
      '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Catalog fixture')
    return git('rev-parse', 'HEAD')
  }
  for (const [path, contents] of Object.entries(files)) await write(path, contents)
  await commit()
  return {
    sourcePath, write, commit,
    outputPath: join(directory, 'app-catalog.json'),
    descriptionsPath: join(directory, 'app-descriptions.json'),
  }
}

test('publishes committed app files and descriptions without requiring a release', async (t) => {
  const options = await fixture(t, {
    'badge/apps/snake/__init__.py': 'print("first")\n',
    'badge/apps/snake/README.md': '# Snake\n\nPlay Snake! More details.\n',
    'badge/apps/snake/assets/leaf #1.png': 'image',
    'badge/apps/snake/__pycache__/cached.pyc': 'cached',
    'badge/apps/Copilot/__init__.py': 'pass\n',
    'badge/apps/menu/__init__.py': 'pass\n',
    'badge/apps/startup/__init__.py': 'pass\n',
    'badge/apps/quest/__init__.py': 'pass\n',
  })
  await options.write('badge/apps/snake/README.md', 'Uncommitted description.\n')
  const first = await syncAppCatalog(options)
  const catalog = JSON.parse(await readFile(options.outputPath, 'utf8'))
  assert.equal(catalog.revision, first.revision)
  assert.deepEqual(catalog.apps, [
    { name: 'Copilot', files: ['__init__.py'] },
    { name: 'snake', files: ['__init__.py', 'assets/leaf #1.png', 'README.md'].sort(), description: 'Play Snake!' },
  ])
  assert.deepEqual(JSON.parse(await readFile(options.descriptionsPath, 'utf8')), { snake: 'Play Snake!' })
  assert.equal((await syncAppCatalog(options)).changed, false)

  await options.write('badge/apps/snake/README.md', '# Snake\n\nPlay Snake! More details.\n')
  await options.write('badge/apps/snake/__init__.py', 'print("fixed")\n')
  const nextRevision = await options.commit()
  await syncAppCatalog(options)
  const updated = JSON.parse(await readFile(options.outputPath, 'utf8'))
  assert.equal(updated.revision, nextRevision)
  assert.notEqual(updated.revision, first.revision)
  assert.deepEqual(updated.apps, catalog.apps)
  assert.notEqual(appFileUrl(updated.revision, 'snake', '__init__.py'), appFileUrl(first.revision, 'snake', '__init__.py'))
})

test('failed catalog validation preserves both last good generated files', async (t) => {
  const options = await fixture(t, {
    'badge/apps/snake/__init__.py': 'pass\n',
    'badge/apps/snake/README.md': 'Play Snake.\n',
  })
  await syncAppCatalog(options)
  const catalog = await readFile(options.outputPath, 'utf8')
  const descriptions = await readFile(options.descriptionsPath, 'utf8')
  await options.write('badge/apps/bad name/__init__.py', 'pass\n')
  await options.commit()
  await assert.rejects(syncAppCatalog(options), /invalid app/)
  assert.equal(await readFile(options.outputPath, 'utf8'), catalog)
  assert.equal(await readFile(options.descriptionsPath, 'utf8'), descriptions)
})

test('rejects symlinks and checkouts without installable apps', async (t) => {
  const options = await fixture(t, { 'badge/apps/docs/README.md': 'Documentation only.\n' })
  await assert.rejects(syncAppCatalog(options), /no installable apps/)
  await options.write('badge/apps/snake/__init__.py', 'pass\n')
  await options.write('badge/apps/snake/README.md', 'Play Snake.\n')
  await symlink('README.md', join(options.sourcePath, 'badge/apps/snake/link'))
  await options.commit()
  await assert.rejects(syncAppCatalog(options), /symlinks or submodules/)
})

test('loads the same-site catalog even when GitHub API requests would be rate limited', async (t) => {
  const requests = []
  let apiStatus = 403
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options })
    return String(url).startsWith('https://api.github.com/')
      ? new Response('', { status: apiStatus })
      : Response.json(published())
  })
  assert.deepEqual(await fetchAppCatalog(), published())
  apiStatus = 429
  assert.deepEqual(await fetchAppCatalog({ refresh: true }), published())
  assert.deepEqual(requests.map(({ url }) => url), ['/app-catalog.json', '/app-catalog.json'])
  assert.equal(requests[1].options.cache, 'no-store')
})

test('rejects failed requests and incomplete or unsafe published catalogs', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }))
  await assert.rejects(fetchAppCatalog(), /503/)
  for (const catalog of [
    null, {}, { ...published(), revision: 'main' }, { ...published(), revision: [published().revision] }, { ...published(), apps: [] },
    { ...published(), apps: [...published().apps, ...published().apps] },
    ...['../snake', 'menu', 'startup', 'quest', 'constructor'].map((name) => ({
      ...published(), apps: [{ ...published().apps[0], name }],
    })),
    ...[[], ['icon.png'], ['__init__.py', '../other.py'], ['__init__.py', '/other.py'],
      ['__init__.py', 'assets\\other.py'], ['__init__.py', '__init__.py']].map((files) => ({
      ...published(), apps: [{ ...published().apps[0], files }],
    })),
  ]) {
    assert.throws(() => validateAppCatalog(catalog), /catalog/)
  }
})

test('downloads from the catalog commit and encodes each file path segment', () => {
  assert.equal(appFileUrl(published().revision, 'Copilot', 'assets/leaf #1.png'),
    `https://raw.githubusercontent.com/badger/home/${published().revision}/badge/apps/Copilot/assets/leaf%20%231.png`)
})
