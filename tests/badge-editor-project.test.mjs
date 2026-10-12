import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { build } from 'esbuild'

async function loadModule(path) {
  const compiled = await build({ entryPoints: [new URL(path, import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', write: false })
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
}
const { projectFile, projectCheckpoint, fileBytes, hasProjectChanges, projectUploadBaseline, removeProjectFile, recordProjectUpload, readBadgeProject, listBadgeApps, simulationRequest, loadSimulatorExample, validateFilePath } = await loadModule('../src/lib/badge-editor-project.ts')
const { uploadEditorProject, ExistingAppError } = await loadModule('../src/lib/badge-editor-upload.ts')
const { getInstallableAppFolders } = await loadModule('../src/lib/github-app-catalog.ts')
const bytes = text => new TextEncoder().encode(text)

function fakeDisk(initial, failPath = '', corrupt = false) {
  const files = new Map(Object.entries(initial).map(([path, data]) => [path, typeof data === 'string' ? bytes(data) : data]))
  const directories = new Set(['', 'apps'])
  for (const path of files.keys()) {
    const parts = path.split('/')
    parts.pop()
    while (parts.length) { directories.add(parts.join('/')); parts.pop() }
  }
  let failureUsed = false
  const writes = []
  const reads = []
  function directory(path) {
    return {
      name: path.split('/').at(-1) || 'BADGER',
      async *values() {
        const prefix = path ? path + '/' : ''
        const entries = new Map()
        for (const key of directories) if (key.startsWith(prefix) && key !== path && !key.slice(prefix.length).includes('/')) entries.set(key.slice(prefix.length), 'directory')
        for (const key of files.keys()) if (key.startsWith(prefix) && !key.slice(prefix.length).includes('/')) entries.set(key.slice(prefix.length), 'file')
        for (const [name, kind] of entries) yield { name, kind }
      },
      async getDirectoryHandle(name, options) {
        const key = path ? path + '/' + name : name
        if (files.has(key)) throw new DOMException('Is a file', 'TypeMismatchError')
        if (!directories.has(key)) {
          if (!options?.create) throw new DOMException('Missing directory', 'NotFoundError')
          directories.add(key)
        }
        return directory(key)
      },
      async getFileHandle(name, options) {
        const key = path + '/' + name
        if (directories.has(key)) throw new DOMException('Is a directory', 'TypeMismatchError')
        if (!files.has(key) && !options?.create) throw new DOMException('Missing file', 'NotFoundError')
        return {
          async getFile() { reads.push(key); return new File([files.get(key) || new Uint8Array()], name) },
          async createWritable() {
            let pending
            return {
              async write(data) { pending = typeof data === 'string' ? bytes(data) : new Uint8Array(data) },
              async close() {
                writes.push(key)
                if (key === failPath && !failureUsed) {
                  failureUsed = true
                  if (corrupt) files.set(key, bytes('corrupt'))
                  else throw new Error('USB disconnected during write')
                } else files.set(key, pending)
              },
              async abort() {},
            }
          },
        }
      },
      async removeEntry(name) {
        const key = path ? path + '/' + name : name
        for (const file of [...files.keys()]) if (file === key || file.startsWith(key + '/')) files.delete(file)
        for (const dir of [...directories]) if (dir === key || dir.startsWith(key + '/')) directories.delete(dir)
      },
    }
  }
  return { root: directory(''), files, directories, writes, reads }
}

function project(name = 'new-app') {
  return { name, sourceName: name, origin: 'example', activePath: '__init__.py', files: [projectFile('__init__.py', bytes('print("hello")')), projectFile('helpers.py', bytes('value = 42')), projectFile('assets/icon.png', new Uint8Array([0, 255, 128]))] }
}

async function flappyProject() {
  const catalog = JSON.parse(await readFile(new URL('../public/editor-apps/catalog.json', import.meta.url)))
  const app = catalog.apps.find(app => app.name === 'flappy')
  const files = await Promise.all(app.files.map(async path => projectFile(path, new Uint8Array(await readFile(new URL(`../public/editor-apps/flappy/${path}`, import.meta.url))))))
  const current = { name: 'flappy', sourceName: 'flappy', origin: 'example', activePath: '__init__.py', files }
  current.checkpoint = projectCheckpoint(current)
  return current
}

test('all 36 simulator examples have packaged source and every referenced asset', async () => {
  const catalog = JSON.parse(await readFile(new URL('../public/editor-examples/catalog.json', import.meta.url)))
  const examples = catalog.categories.flatMap(category => category.examples)
  assert.equal(examples.length, 36)
  assert.equal(new Set(examples.map(example => example.file)).size, 36)
  for (const example of examples) {
    assert.match(example.file, /^[a-z0-9_]+\.py$/)
    const source = await readFile(new URL(`../public/editor-examples/${example.file}`, import.meta.url), 'utf8')
    const referenced = [...new Set([...source.matchAll(/["']\/system\/(assets\/[^"']+)["']/g)].map(match => match[1]))]
    assert.deepEqual(example.assets, referenced)
    for (const asset of example.assets) assert.ok((await readFile(new URL(`../public/editor-examples/${asset}`, import.meta.url))).length > 0)
  }
})

test('simulator examples become editable installable projects with local asset paths', async t => {
  const catalog = JSON.parse(await readFile(new URL('../public/editor-examples/catalog.json', import.meta.url)))
  t.mock.method(globalThis, 'fetch', async url => new Response(await readFile(new URL(`../public${url}`, import.meta.url))))
  for (const example of catalog.categories.flatMap(category => category.examples)) {
    const loaded = await loadSimulatorExample(example)
    assert.match(loaded.name, /^example-[a-z0-9-]+$/)
    assert.equal(loaded.files[0].path, '__init__.py')
    assert.equal(loaded.files[0].text.includes('/system/assets/'), false)
    if (['text.py', 'vector_text.py'].includes(example.file)) {
      assert.match(loaded.files[0].text, /add_glyph\(glyph_name, renderer\)/)
      assert.match(loaded.files[0].text, /screen.text\(message, bounds/)
      assert.doesNotMatch(loaded.files[0].text, /^  tokens = text\.tokenise/m)
    }
    assert.deepEqual(loaded.files.slice(1).map(file => file.path), example.assets)
    assert.equal(simulationRequest(loaded).files.length, 1 + example.assets.length)
    const disk = fakeDisk({})
    const result = await uploadEditorProject(disk.root, loaded)
    assert.equal(result.written, loaded.files.length)
  }
})

test('missing example assets fail loading instead of creating an incomplete project', async t => {
  t.mock.method(globalThis, 'fetch', async url => new Response(url.endsWith('sprites.py') ? 'image.load("/system/assets/skull.png")' : '', { status: url.endsWith('sprites.py') ? 200 : 404 }))
  await assert.rejects(loadSimulatorExample({ file: 'sprites.py', description: 'sprite blit', assets: ['assets/skull.png'] }), /Could not load assets\/skull.png/)
  await assert.rejects(loadSimulatorExample({ file: '../startup.py', description: '', assets: [] }), /Invalid example filename/)
})

test('a one-line example edit updates one file in a nine-file app without reading or replacing its other files', async () => {
  const current = await flappyProject()
  const initial = Object.fromEntries(current.files.map(file => [`apps/flappy/${file.path}`, new Uint8Array(file.data)]))
  initial['apps/flappy/icon.png'] = bytes('different installed icon')
  const disk = fakeDisk(initial)
  current.files.find(file => file.path === '__init__.py').text += '\nvalue = 1\n'
  const progress = []
  const snapshot = structuredClone(current)
  const result = await uploadEditorProject(disk.root, snapshot, { replace: true, onProgress: item => progress.push(item) })
  assert.equal(result.written, 1)
  assert.equal(result.created, false)
  assert.deepEqual(disk.writes, ['apps/flappy/__init__.py'])
  assert.deepEqual(disk.reads, ['apps/flappy/__init__.py', 'apps/flappy/__init__.py'])
  for (const [path, data] of Object.entries(initial)) if (!path.endsWith('/__init__.py')) assert.deepEqual(disk.files.get(path), data)
  assert.deepEqual(progress, [{ path: '__init__.py', completed: 0, total: 1 }, { path: '__init__.py', completed: 1, total: 1 }])
  recordProjectUpload(current, snapshot, result.verified)
  assert.deepEqual(current.diskPaths, ['__init__.py'])
  const restored = structuredClone(current)
  restored.files.find(file => file.path === 'mona.py').text += '\nvalue = 2\n'
  disk.reads.length = 0
  disk.writes.length = 0
  const nextSnapshot = structuredClone(restored)
  const next = await uploadEditorProject(disk.root, nextSnapshot, { expected: projectUploadBaseline(restored) })
  assert.equal(next.written, 1)
  assert.deepEqual(disk.writes, ['apps/flappy/mona.py'])
  assert.deepEqual(disk.reads, ['apps/flappy/mona.py', 'apps/flappy/mona.py'])
  recordProjectUpload(restored, nextSnapshot, next.verified)
  disk.reads.length = 0
  disk.writes.length = 0
  const unchanged = await uploadEditorProject(disk.root, restored, { expected: projectUploadBaseline(restored) })
  assert.equal(unchanged.written, 0)
  assert.deepEqual(disk.writes, [])
  assert.deepEqual(disk.reads, [])
})

test('first install copies all nine required files even when only one example file was edited', async () => {
  const current = await flappyProject()
  current.files[0].text += '\nvalue = 1\n'
  const disk = fakeDisk({})
  const result = await uploadEditorProject(disk.root, current)
  assert.equal(result.created, true)
  assert.equal(result.written, 9)
  assert.equal(result.verified.size, 9)
  assert.equal(disk.writes.at(-1), 'apps/flappy/__init__.py')
  for (const file of current.files) assert.deepEqual(disk.files.get(`apps/flappy/${file.path}`), fileBytes(file))
})

test('restored badge drafts retain their upload baseline and write only the edited file', async () => {
  const current = await flappyProject()
  const disk = fakeDisk(Object.fromEntries(current.files.map(file => [`apps/flappy/${file.path}`, file.data])))
  const opened = await readBadgeProject(disk.root, 'flappy')
  opened.checkpoint = projectCheckpoint(opened)
  opened.files.find(file => file.path === '__init__.py').text += '\nvalue = 1\n'
  const restored = structuredClone(opened)
  disk.reads.length = 0
  const result = await uploadEditorProject(disk.root, restored, { expected: projectUploadBaseline(restored) })
  assert.equal(result.written, 1)
  assert.deepEqual(disk.writes, ['apps/flappy/__init__.py'])
  assert.deepEqual(disk.reads, ['apps/flappy/__init__.py', 'apps/flappy/__init__.py'])
})

test('unchanged UTF-8 BOM files remain byte-identical and are skipped', async () => {
  const bomBytes = text => new Uint8Array([0xef, 0xbb, 0xbf, ...bytes(text)])
  const disk = fakeDisk({ 'apps/demo/__init__.py': bomBytes('value = 1\r\n'), 'apps/demo/helpers.py': bomBytes('value = 2\r\n') })
  const current = await readBadgeProject(disk.root, 'demo')
  current.checkpoint = projectCheckpoint(current)
  assert.equal(hasProjectChanges(current), false)
  current.files.find(file => file.path === '__init__.py').text = 'value = 3\r\n'
  disk.reads.length = 0
  const result = await uploadEditorProject(disk.root, current, { expected: projectUploadBaseline(current) })
  assert.equal(result.written, 1)
  assert.deepEqual(disk.writes, ['apps/demo/__init__.py'])
  assert.deepEqual(disk.reads, ['apps/demo/__init__.py', 'apps/demo/__init__.py'])
  assert.deepEqual(disk.files.get('apps/demo/__init__.py'), bomBytes('value = 3\r\n'))
  assert.deepEqual(disk.files.get('apps/demo/helpers.py'), bomBytes('value = 2\r\n'))
})

test('new empty files are uploaded once and tracked separately from untouched example files', async () => {
  const current = project('demo')
  current.checkpoint = projectCheckpoint(current)
  current.origin = 'badge'
  current.diskPaths = ['__init__.py']
  current.files.push(projectFile('empty.py', new Uint8Array()))
  const disk = fakeDisk({ 'apps/demo/__init__.py': current.files[0].data })
  const snapshot = structuredClone(current)
  const result = await uploadEditorProject(disk.root, snapshot, { expected: projectUploadBaseline(snapshot) })
  assert.deepEqual(disk.writes, ['apps/demo/empty.py'])
  assert.equal(disk.files.get('apps/demo/empty.py').length, 0)
  assert.equal(result.verified.has('helpers.py'), false)
  recordProjectUpload(current, snapshot, result.verified)
  disk.writes.length = 0
  assert.equal((await uploadEditorProject(disk.root, current, { expected: projectUploadBaseline(current) })).written, 0)
})

test('partial updates do not mark unverified companion modules as saved on the badge', async () => {
  const current = project('demo')
  current.checkpoint = projectCheckpoint(current)
  current.files[0].text = 'print("first update")'
  const disk = fakeDisk({ 'apps/demo/__init__.py': 'old source', 'apps/demo/helpers.py': 'different installed helper' })
  const snapshot = structuredClone(current)
  const result = await uploadEditorProject(disk.root, snapshot, { replace: true })
  recordProjectUpload(current, snapshot, result.verified)
  current.files[1].text = 'value = 99'
  const expected = projectUploadBaseline(current)
  assert.equal(expected.has('helpers.py'), false)
  disk.writes.length = 0
  await assert.rejects(uploadEditorProject(disk.root, current, { expected }), ExistingAppError)
  assert.deepEqual(disk.writes, [])
  const next = await uploadEditorProject(disk.root, current, { expected, replace: true })
  assert.equal(next.written, 1)
  assert.deepEqual(disk.writes, ['apps/demo/helpers.py'])
})

test('a changed file already matching the badge is accepted without another write', async () => {
  const current = project('demo')
  current.origin = 'badge'
  current.checkpoint = projectCheckpoint(current)
  current.files[0].text = 'print("already applied")'
  const disk = fakeDisk({ 'apps/demo/__init__.py': fileBytes(current.files[0]) })
  const result = await uploadEditorProject(disk.root, current, { expected: projectUploadBaseline(current) })
  assert.equal(result.written, 0)
  assert.deepEqual(disk.writes, [])
  assert.deepEqual(disk.reads, ['apps/demo/__init__.py'])
  assert.deepEqual(result.verified.get('__init__.py'), fileBytes(current.files[0]))
})

test('every current bundled app uses the same inclusion rules as /apps', async () => {
  const catalog = JSON.parse(await readFile(new URL('../public/editor-apps/catalog.json', import.meta.url)))
  const tree = []
  async function visit(url, prefix) {
    for (const entry of await readdir(url, { withFileTypes: true })) {
      if (entry.isDirectory()) await visit(new URL(entry.name + '/', url), prefix + entry.name + '/')
      else tree.push({ path: prefix + entry.name, type: 'blob' })
    }
  }
  await visit(new URL('../public/editor-apps/', import.meta.url), 'badge/apps/')
  const expected = getInstallableAppFolders(tree).map(([name]) => name).sort()
  assert.deepEqual(catalog.apps.map(app => app.name).sort(), expected)
  assert.equal(catalog.apps.length, 23)
  for (const app of catalog.apps) {
    assert(app.files.includes('__init__.py'))
    for (const path of app.files) await readFile(new URL(`../public/editor-apps/${app.name}/${path}`, import.meta.url))
  }
})

test('device browser lists editable app source and excludes protected launchers', async () => {
  const disk = fakeDisk({ 'apps/demo/__init__.py': 'demo', 'apps/menu/__init__.py': 'menu', 'apps/startup/__init__.py': 'startup', 'apps/compiled/__init__.mpy': 'binary' })
  assert.deepEqual(await listBadgeApps(disk.root), ['demo'])
})

test('reads nested Python files and binary assets from the badge', async () => {
  const disk = fakeDisk({ 'apps/demo/__init__.py': 'import helpers', 'apps/demo/helpers.py': 'answer = 42', 'apps/demo/assets/icon.png': new Uint8Array([0, 255]), 'apps/demo/.hidden': 'hidden' })
  const opened = await readBadgeProject(disk.root, 'demo')
  assert.equal(opened.origin, 'badge')
  assert.equal(opened.files.find(file => file.path === 'helpers.py').text, 'answer = 42')
  assert.deepEqual(opened.files.find(file => file.path === 'assets/icon.png').data, new Uint8Array([0, 255]))
  assert.equal(opened.files.length, 3)
})

test('simulation stages exactly the files uploaded to the current app folder', async () => {
  const current = project('demo-copy')
  current.sourceName = 'demo'
  current.files[1].text = 'value = 99'
  const request = simulationRequest(current)
  assert(request.program.includes('/system/apps/demo-copy/__init__.py'))
  assert.equal(request.files.length, current.files.length)
  assert.equal(new TextDecoder().decode(request.files.find(file => file.name === '/system/apps/demo-copy/helpers.py').content), 'value = 99')
  const disk = fakeDisk({})
  await uploadEditorProject(disk.root, current)
  for (const file of request.files) assert.deepEqual(disk.files.get(file.name.replace('/system/', '')), file.content)
  assert(request.files.every(file => file.name.startsWith('/system/apps/demo-copy/')))
})

test('renamed apps with fixed paths cannot simulate or write until their source paths are updated', async () => {
  const current = project('tomato-copy')
  current.sourceName = 'tomato'
  current.files[0] = projectFile('__init__.py', new Uint8Array(await readFile(new URL('../public/editor-apps/tomato/__init__.py', import.meta.url))))
  assert.throws(() => simulationRequest(current), /still references the tomato app folder/)
  const disk = fakeDisk({})
  await assert.rejects(uploadEditorProject(disk.root, current), /still references the tomato app folder/)
  assert.equal(disk.writes.length, 0)
  assert.equal(disk.directories.has('apps/tomato-copy'), false)
  current.files[0].text = current.files[0].text.replaceAll('/system/apps/tomato', '/system/apps/tomato-copy')
  const request = simulationRequest(current)
  await uploadEditorProject(disk.root, current)
  assert(request.files.every(file => file.name.startsWith('/system/apps/tomato-copy/')))
})

test('fixed paths in companion modules also block renamed uploads', async () => {
  const current = project('demo-copy')
  current.sourceName = 'demo'
  for (const root of ['/system/apps/demo', '/remote/apps/demo', '/apps/demo', '/demo']) {
    current.files[1].text = `path = "${root}/assets/icon.png"`
    assert.throws(() => simulationRequest(current), /helpers.py still references/)
    await assert.rejects(uploadEditorProject(fakeDisk({}).root, current), /helpers.py still references/)
  }
  current.files[1].text = 'path = "/system/apps/demo-copy/assets/icon.png"'
  assert.doesNotThrow(() => simulationRequest(current))
})

test('project changes include edits, empty added files, removed files, and renames across draft restoration', () => {
  const current = project()
  current.checkpoint = projectCheckpoint(current)
  assert.equal(hasProjectChanges(current), false)
  current.files[0].text += '\nprint("changed")'
  assert.equal(hasProjectChanges(current), true)
  current.files[0].text = new TextDecoder().decode(current.files[0].data)
  assert.equal(hasProjectChanges(current), false)
  current.files.push(projectFile('empty.py', new Uint8Array()))
  assert.equal(hasProjectChanges(structuredClone(current)), true)
  current.files.pop()
  current.name = 'renamed'
  assert.equal(hasProjectChanges(structuredClone(current)), true)
  current.name = current.checkpoint.name
  current.files.pop()
  assert.equal(hasProjectChanges(current), true)
})

test('legacy drafts without a checkpoint are protected conservatively', () => {
  assert.equal(hasProjectChanges(project()), true)
})

test('edits made after an upload snapshot remain dirty', () => {
  const current = project()
  current.files[0].text = 'print("uploaded")'
  const snapshot = structuredClone(current)
  current.files[0].text = 'print("typed while uploading")'
  recordProjectUpload(current, snapshot, new Map(snapshot.files.map(file => [file.path, fileBytes(file)])))
  assert.equal(current.files[0].text, 'print("typed while uploading")')
  assert.deepEqual(current.files[0].data, bytes('print("uploaded")'))
  assert.equal(hasProjectChanges(current), true)
})

test('uploads complete projects including assets and commits entry point last', async () => {
  const disk = fakeDisk({})
  const result = await uploadEditorProject(disk.root, project())
  assert.equal(result.written, 3)
  assert.deepEqual(disk.files.get('apps/new-app/assets/icon.png'), new Uint8Array([0, 255, 128]))
  assert.equal(disk.writes.at(-1), 'apps/new-app/__init__.py')
})

test('badge round trip writes only edited files and preserves other device files', async () => {
  const disk = fakeDisk({ 'apps/demo/__init__.py': 'print("original")', 'apps/demo/helpers.py': 'value = 1', 'apps/demo/state.json': '{"keep":true}' })
  const opened = await readBadgeProject(disk.root, 'demo')
  const expected = new Map(opened.files.map(file => [file.path, new Uint8Array(file.data)]))
  opened.files.find(file => file.path === 'helpers.py').text = 'value = 2'
  const result = await uploadEditorProject(disk.root, opened, { expected })
  assert.equal(result.written, 1)
  assert.deepEqual(disk.writes, ['apps/demo/helpers.py'])
  assert.equal(new TextDecoder().decode(disk.files.get('apps/demo/state.json')), '{"keep":true}')
})

test('external edits are detected before overwriting device source', async () => {
  const disk = fakeDisk({ 'apps/demo/__init__.py': 'original' })
  const opened = await readBadgeProject(disk.root, 'demo')
  const expected = new Map(opened.files.map(file => [file.path, new Uint8Array(file.data)]))
  opened.files[0].text = 'editor changes'
  disk.files.set('apps/demo/__init__.py', bytes('external changes'))
  await assert.rejects(uploadEditorProject(disk.root, opened, { expected }), /changed on the badge/)
  assert.equal(disk.writes.length, 0)
  assert.equal(new TextDecoder().decode(disk.files.get('apps/demo/__init__.py')), 'external changes')
})

test('failed multi-file replacement restores all previously changed files', async () => {
  const initial = { 'apps/new-app/__init__.py': 'original source', 'apps/new-app/helpers.py': 'old helper', 'apps/new-app/assets/icon.png': new Uint8Array([12]), 'apps/new-app/untouched.txt': 'keep' }
  const disk = fakeDisk(initial, 'apps/new-app/__init__.py', true)
  await assert.rejects(uploadEditorProject(disk.root, project(), { replace: true }), /read-back verification/)
  for (const [path, data] of Object.entries(initial)) assert.deepEqual(disk.files.get(path), typeof data === 'string' ? bytes(data) : data)
})

test('failed new project removes incomplete files and directories', async () => {
  const disk = fakeDisk({}, 'apps/new-app/helpers.py')
  await assert.rejects(uploadEditorProject(disk.root, project()), /USB disconnected/)
  assert.equal(disk.files.size, 0)
  assert.equal(disk.directories.has('apps/new-app'), false)
})

test('unsafe file paths are rejected before any device write', async () => {
  for (const path of ['/secrets.py', '../main.py', 'assets/../main.py', 'a//b.py', 'a\\b.py', 'a/./b.py']) assert.throws(() => validateFilePath(path))
  const current = project()
  current.files[1].path = '../main.py'
  const disk = fakeDisk({})
  await assert.rejects(uploadEditorProject(disk.root, current), /relative file path/)
  assert.equal(disk.writes.length, 0)
})


test('deleting a badge file is saved in the draft and applied without rewriting unchanged files', async () => {
  const disk = fakeDisk({ 'apps/demo/__init__.py': 'source', 'apps/demo/helpers.py': 'helper', 'apps/demo/assets/icon.png': bytes('icon') })
  const current = await readBadgeProject(disk.root, 'demo')
  current.checkpoint = projectCheckpoint(current)
  current.activePath = 'helpers.py'
  removeProjectFile(current, 'helpers.py')
  assert.equal(current.activePath, '__init__.py')
  assert.equal(hasProjectChanges(current), true)
  const restored = structuredClone(current)
  disk.reads.length = 0
  const snapshot = structuredClone(restored)
  const result = await uploadEditorProject(disk.root, snapshot, { expected: projectUploadBaseline(snapshot) })
  assert.equal(result.written, 0)
  assert.equal(result.deleted, 1)
  assert.equal(disk.files.has('apps/demo/helpers.py'), false)
  assert.deepEqual(disk.writes, [])
  assert.deepEqual(disk.reads, ['apps/demo/helpers.py'])
  assert.equal(disk.files.has('apps/demo/assets/icon.png'), true)
  recordProjectUpload(restored, snapshot, result.verified)
  assert.equal(hasProjectChanges(restored), false)
  assert.equal(restored.removedFiles.length, 0)
  assert.equal(projectUploadBaseline(restored).has('helpers.py'), false)
})

test('external edits block deletion before any changed files are written', async () => {
  const disk = fakeDisk({ 'apps/demo/__init__.py': 'source', 'apps/demo/helpers.py': 'helper' })
  const current = await readBadgeProject(disk.root, 'demo')
  current.checkpoint = projectCheckpoint(current)
  removeProjectFile(current, 'helpers.py')
  current.files[0].text = 'new source'
  disk.files.set('apps/demo/helpers.py', bytes('external changes'))
  await assert.rejects(uploadEditorProject(disk.root, current, { expected: projectUploadBaseline(current) }), /changed on the badge/)
  assert.deepEqual(disk.writes, [])
  assert.deepEqual(disk.files.get('apps/demo/helpers.py'), bytes('external changes'))
})

test('deleted files are restored if a later write fails', async () => {
  const initial = { 'apps/demo/__init__.py': 'source', 'apps/demo/helpers.py': 'helper' }
  const disk = fakeDisk(initial, 'apps/demo/__init__.py')
  const current = await readBadgeProject(disk.root, 'demo')
  current.checkpoint = projectCheckpoint(current)
  removeProjectFile(current, 'helpers.py')
  current.files[0].text = 'new source'
  await assert.rejects(uploadEditorProject(disk.root, current, { expected: projectUploadBaseline(current) }), /USB disconnected/)
  for (const [path, text] of Object.entries(initial)) assert.deepEqual(disk.files.get(path), bytes(text))
})

test('deleting an added file cancels its upload and deleting the entry point is rejected', () => {
  const current = project('demo')
  current.checkpoint = projectCheckpoint(current)
  current.files.push(projectFile('scratch.py', bytes('draft')))
  removeProjectFile(current, 'scratch.py')
  assert.equal(current.removedFiles?.length || 0, 0)
  assert.equal(hasProjectChanges(current), false)
  assert.throws(() => removeProjectFile(current, '__init__.py'), /entry point/)
})

test('deleted example files are omitted from a first install and renamed uploads preserve the original app', async () => {
  const current = project('demo')
  current.checkpoint = projectCheckpoint(current)
  removeProjectFile(current, 'helpers.py')
  const disk = fakeDisk({ 'apps/demo/__init__.py': 'original', 'apps/demo/helpers.py': 'helper' })
  current.name = 'demo-copy'
  const result = await uploadEditorProject(disk.root, current)
  assert.equal(result.deleted, 0)
  assert.equal(result.written, 2)
  assert.equal(disk.files.has('apps/demo-copy/helpers.py'), false)
  assert.deepEqual(disk.files.get('apps/demo/helpers.py'), bytes('helper'))
})
