import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { build } from 'esbuild'

async function loadModule(path) {
  const compiled = await build({ entryPoints: [new URL(path, import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', write: false })
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
}
const { projectFile, projectCheckpoint, hasProjectChanges, readBadgeProject, listBadgeApps, simulationRequest, validateFilePath } = await loadModule('../src/lib/badge-editor-project.ts')
const { uploadEditorProject } = await loadModule('../src/lib/badge-editor-upload.ts')
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
          async getFile() { return new File([files.get(key) || new Uint8Array()], name) },
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
  return { root: directory(''), files, directories, writes }
}

function project(name = 'new-app') {
  return { name, sourceName: name, origin: 'example', activePath: '__init__.py', files: [projectFile('__init__.py', bytes('print("hello")')), projectFile('helpers.py', bytes('value = 42')), projectFile('assets/icon.png', new Uint8Array([0, 255, 128]))] }
}

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
  const snapshot = structuredClone(current)
  current.files[0].text = 'print("typed while uploading")'
  current.checkpoint = projectCheckpoint(snapshot)
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
