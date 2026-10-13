import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: [new URL('../src/lib/badge-editor-upload.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', write: false })
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
const { uploadEditorApp, uploadEditorProject, ExistingAppError } = await import(moduleUrl)

function filesystem(existing = false, failure = '') {
  const files = new Map(existing ? [['__init__.py', 'original'], ['icon.png', 'icon']] : [])
  let present = existing
  let closes = 0
  let aborted = false
  let deleted = false
  const app = {
    async getFileHandle(name, options) {
      if (!files.has(name) && !options?.create) throw new DOMException('Missing', 'NotFoundError')
      return {
        async getFile() { return new File([files.get(name) || ''], name) },
        async createWritable() {
          let pending = ''
          return {
            async write(text) {
              if (failure === 'write' && closes === 0) { closes++; throw new Error('USB write failed') }
              pending = text
            },
            async close() { closes++; files.set(name, failure === 'verify' && closes === 1 ? 'corrupted' : pending) },
            async abort() { aborted = true },
          }
        },
      }
    },
    async removeEntry(name) { files.delete(name) },
  }
  const apps = {
    async getDirectoryHandle(name, options) {
      if (!present && !options?.create) throw new DOMException('Missing', 'NotFoundError')
      present = true
      return app
    },
    async removeEntry() { present = false; deleted = true; files.clear() },
  }
  const root = { async getDirectoryHandle() { return apps } }
  return { root, files, get aborted() { return aborted }, get deleted() { return deleted } }
}

test('uploads UTF-8 Python and verifies file contents', async () => {
  const disk = filesystem()
  assert.equal(await uploadEditorApp(disk.root, 'my-app', 'print("Hello 🦡")'), '/apps/my-app/__init__.py')
  assert.equal(disk.files.get('__init__.py'), 'print("Hello 🦡")')
})

test('existing apps require explicit replacement', async () => {
  const disk = filesystem(true)
  await assert.rejects(uploadEditorApp(disk.root, 'my-app', 'new'), ExistingAppError)
  assert.equal(disk.files.get('__init__.py'), 'original')
})

test('replacement preserves other app files', async () => {
  const disk = filesystem(true)
  await uploadEditorApp(disk.root, 'my-app', 'new', true)
  assert.equal(disk.files.get('__init__.py'), 'new')
  assert.equal(disk.files.get('icon.png'), 'icon')
})

test('failed verification restores the previous source', async () => {
  const disk = filesystem(true, 'verify')
  await assert.rejects(uploadEditorApp(disk.root, 'my-app', 'new', true), /read-back verification/)
  assert.equal(disk.files.get('__init__.py'), 'original')
  assert.equal(disk.files.get('icon.png'), 'icon')
})

test('failed new upload aborts the writer and removes its incomplete app', async () => {
  const disk = filesystem(false, 'write')
  await assert.rejects(uploadEditorApp(disk.root, 'my-app', 'new'), /USB write failed/)
  assert.equal(disk.aborted, true)
  assert.equal(disk.deleted, true)
})

test('reserved names and paths are rejected before disk access', async () => {
  const disk = { async getDirectoryHandle() { assert.fail('Disk must not be accessed') } }
  for (const name of ['menu', 'startup', '../system', 'bad/app', '', 'Bad App', 'a'.repeat(49)]) {
    await assert.rejects(uploadEditorApp(disk, name, 'new'))
  }
})

test('permission errors are surfaced without creating an app', async () => {
  const disk = { async getDirectoryHandle() { throw new DOMException('Permission denied', 'NotAllowedError') } }
  await assert.rejects(uploadEditorApp(disk, 'my-app', 'new'), /Permission denied/)
})
