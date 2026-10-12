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
  checkpoint?: { name: string; paths: string[] }
  diskPaths?: string[]
}

export type EditorCatalogApp = { name: string; title: string; files: string[] }
export type EditorCatalog = { revision: string; apps: EditorCatalogApp[] }
export type SimulatorExample = { file: string; description: string; assets: string[] }
export type SimulatorExamples = { revision: string; categories: { name: string; examples: SimulatorExample[] }[] }

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
  if (file.text === null) return file.data
  const data = encoder.encode(file.text)
  if (file.data[0] !== 0xef || file.data[1] !== 0xbb || file.data[2] !== 0xbf) return data
  const withBom = new Uint8Array(data.length + 3)
  withBom.set([0xef, 0xbb, 0xbf])
  withBom.set(data, 3)
  return withBom
}

export function bytesEqual(left: Uint8Array, right: Uint8Array) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function projectCheckpoint(project: EditorProject) {
  return { name: project.name, paths: project.files.map(file => file.path) }
}

export function projectUploadBaseline(project: EditorProject) {
  if (project.origin !== 'badge' || project.name !== project.sourceName) return undefined
  const paths = project.diskPaths || project.checkpoint?.paths
  return new Map(project.files.filter(file => paths ? paths.includes(file.path) : file.data.length > 0).map(file => [file.path, file.data]))
}

export function editedProjectFiles(project: EditorProject) {
  const paths = project.checkpoint?.paths
  return project.files.filter(file => !paths || !paths.includes(file.path) || !bytesEqual(file.data, fileBytes(file)))
}

export function uploadProjectFiles(project: EditorProject, existing: boolean) {
  return !existing || project.origin === 'new' ? project.files : editedProjectFiles(project)
}

export function recordProjectUpload(project: EditorProject, snapshot: EditorProject, verified: Map<string, Uint8Array>) {
  project.origin = 'badge'
  project.sourceName = snapshot.name
  for (const file of project.files) {
    const data = verified.get(file.path)
    if (data) file.data = data
  }
  project.diskPaths = [...verified.keys()]
  project.checkpoint = projectCheckpoint(snapshot)
}

export function hasProjectChanges(project: EditorProject) {
  const checkpoint = project.checkpoint
  return !checkpoint || checkpoint.name !== project.name || checkpoint.paths.length !== project.files.length ||
    project.files.some(file => !checkpoint.paths.includes(file.path) || !bytesEqual(file.data, fileBytes(file)))
}

export function validateProjectLocation(project: EditorProject) {
  if (project.name === project.sourceName) return
  const roots = [`/system/apps/${project.sourceName}`, `/remote/apps/${project.sourceName}`, `/apps/${project.sourceName}`, `/${project.sourceName}`]
  const escapedRoots = roots.map(root => root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const reference = new RegExp(`(?:${escapedRoots.join('|')})(?=[/"'\\x60\\s]|$)`)
  const file = project.files.find(file => /\.py$/i.test(file.path) && file.text !== null && reference.test(file.text))
  if (file) throw new Error(`${file.path} still references the ${project.sourceName} app folder. Keep that app name, or update its paths to ${project.name} before running or uploading.`)
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
  return { name, sourceName: name, files: files.sort((a, b) => a.path.localeCompare(b.path)), origin: 'badge', activePath: '__init__.py', diskPaths: files.map(file => file.path) }
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

export async function loadSimulatorExample(example: SimulatorExample): Promise<EditorProject> {
  if (!/^[a-z0-9_]+\.py$/.test(example.file)) throw new Error('Invalid example filename.')
  const response = await fetch(`/editor-examples/${example.file}`)
  if (!response.ok) throw new Error('Could not load this example. Try again.')
  let source = await response.text()
  const files: ProjectFile[] = []
  for (const asset of example.assets) {
    validateFilePath(asset)
    source = source.replaceAll(`/system/${asset}`, asset)
    const assetResponse = await fetch(`/editor-examples/${asset.split('/').map(encodeURIComponent).join('/')}`)
    if (!assetResponse.ok) throw new Error(`Could not load ${asset}. Try again.`)
    files.push(projectFile(asset, new Uint8Array(await assetResponse.arrayBuffer())))
  }
  files.unshift(projectFile('__init__.py', encoder.encode(source)))
  const name = `example-${example.file.replace(/\.py$/, '').replaceAll('_', '-')}`
  return { name, sourceName: name, origin: 'example', activePath: '__init__.py', files }
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
  validateProjectLocation(project)
  const entry = project.files.find(file => file.path === '__init__.py')
  if (!entry || entry.text === null) throw new Error('Add an editable __init__.py to simulate this app.')
  const root = `/system/apps/${project.name}`
  const files = project.files.map(file => ({ name: `${root}/${file.path}`, content: fileBytes(file) }))
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
