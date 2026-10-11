import type { DiskDirectory } from './badge-editor-upload'

export type ProjectFile = {
  path: string
  data: Uint8Array
  text: string | null
}

export type EditorProject = {
  name: string
  sourceName: string
  files: ProjectFile[]
  origin: 'new' | 'example' | 'badge'
  activePath: string
}

export type EditorCatalogApp = { name: string; title: string; files: string[] }
export type EditorCatalog = { revision: string; apps: EditorCatalogApp[] }

const encoder = new TextEncoder()
const maxProjectBytes = 16 * 1024 * 1024

export function validateFilePath(path: string) {
  const parts = path.split('/')
  if (!parts.length || parts.length > 12 || parts.some(part => !part || part === '.' || part === '..' || /[\\\x00-\x1f<>:"|?*]/.test(part))) {
    throw new Error('Use a relative file path without empty folders, parent paths, or special characters.')
  }
  return path
}

export function projectFile(path: string, data: Uint8Array): ProjectFile {
  validateFilePath(path)
  const textFile = /\.(py|txt|json|csv|md|ini|toml|yaml|yml)$/i.test(path)
  let text: string | null = null
  if (textFile) {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(data) } catch { text = null }
  }
  return { path, data, text }
}

export function fileBytes(file: ProjectFile) {
  return file.text === null ? file.data : encoder.encode(file.text)
}

export function bytesEqual(left: Uint8Array, right: Uint8Array) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export async function readBadgeProject(root: DiskDirectory, name: string): Promise<EditorProject> {
  const appRoot = await (await root.getDirectoryHandle('apps')).getDirectoryHandle(name)
  const files: ProjectFile[] = []
  let total = 0
  async function visit(directory: DiskDirectory, prefix = '', depth = 0) {
    if (depth > 12) throw new Error('This app contains too many nested folders.')
    for await (const entry of directory.values()) {
      if (entry.name.startsWith('.') || entry.name === '__pycache__') continue
      const path = validateFilePath(prefix + entry.name)
      if (entry.kind === 'directory') {
        await visit(await directory.getDirectoryHandle(entry.name), `${path}/`, depth + 1)
      } else {
        const file = await (await directory.getFileHandle(entry.name)).getFile()
        total += file.size
        if (total > maxProjectBytes) throw new Error('This app exceeds the 16 MB editor limit.')
        files.push(projectFile(path, new Uint8Array(await file.arrayBuffer())))
      }
    }
  }
  await visit(appRoot)
  if (!files.some(file => file.path === '__init__.py')) throw new Error('This app has no editable __init__.py source file.')
  return { name, sourceName: name, files: files.sort((a, b) => a.path.localeCompare(b.path)), origin: 'badge', activePath: '__init__.py' }
}

export async function listBadgeApps(root: DiskDirectory) {
  const appsRoot = await root.getDirectoryHandle('apps')
  const names: string[] = []
  for await (const entry of appsRoot.values()) {
    if (entry.kind !== 'directory' || entry.name.startsWith('.') || ['menu', 'startup'].includes(entry.name)) continue
    try {
      await (await appsRoot.getDirectoryHandle(entry.name)).getFileHandle('__init__.py')
      names.push(entry.name)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error
    }
  }
  return names.sort()
}

export async function loadExampleProject(app: EditorCatalogApp): Promise<EditorProject> {
  let total = 0
  const files: ProjectFile[] = []
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(6, app.files.length) }, async () => {
    while (cursor < app.files.length) {
      const path = validateFilePath(app.files[cursor++])
      const response = await fetch(`/editor-apps/${encodeURIComponent(app.name)}/${path.split('/').map(encodeURIComponent).join('/')}`)
      if (!response.ok) throw new Error(`Could not load ${app.name}/${path}. Reload and try again.`)
      const data = new Uint8Array(await response.arrayBuffer())
      total += data.length
      if (total > maxProjectBytes) throw new Error('This app exceeds the 16 MB editor limit.')
      files.push(projectFile(path, data))
    }
  }))
  return { name: app.name, sourceName: app.name, files: files.sort((a, b) => a.path.localeCompare(b.path)), origin: 'example', activePath: '__init__.py' }
}

export function simulationRequest(project: EditorProject) {
  const entry = project.files.find(file => file.path === '__init__.py')
  if (!entry || entry.text === null) throw new Error('Add an editable __init__.py to simulate this app.')
  const names = [...new Set([project.name, project.sourceName])]
  const roots = names.flatMap(name => [`/apps/${name}`, `/system/apps/${name}`, `/remote/apps/${name}`, `/${name}`])
  const files = roots.flatMap(root => project.files.map(file => ({ name: `${root}/${file.path}`, content: fileBytes(file) })))
  const root = `/apps/${project.name}`
  const path = `${root}/__init__.py`
  const program = `import editor_support
import os, sys\nos.chdir(${JSON.stringify(root)})\nsys.path.insert(0, ${JSON.stringify(root)})\n__file__ = ${JSON.stringify(path)}\nexec(compile(${JSON.stringify(entry.text)}, __file__, 'exec'))`
  return { program, files }
}

export async function readProjectDraft(): Promise<EditorProject | null> {
  const db = await openDraftDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('drafts').objectStore('drafts').get('current')
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}

export async function saveProjectDraft(project: EditorProject) {
  const db = await openDraftDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('drafts', 'readwrite')
      transaction.objectStore('drafts').put(project, 'current')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally { db.close() }
}

function openDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('badger-editor-projects', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('drafts')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
