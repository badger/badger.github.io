import { bytesEqual, fileBytes, validateFilePath, validateProjectLocation, type EditorProject } from './badge-editor-project'

export type DiskFile = {
  getFile: () => Promise<File>
  createWritable: () => Promise<{ write: (data: string | Uint8Array) => Promise<void>; close: () => Promise<void>; abort: () => Promise<void> }>
}

export type DiskDirectory = {
  name: string
  values: () => AsyncIterableIterator<{ name: string; kind: 'file' | 'directory' }>
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<DiskDirectory>
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<DiskFile>
  removeEntry: (name: string, options?: { recursive?: boolean }) => Promise<void>
}

export class ExistingAppError extends Error {
  constructor() {
    super('This app already exists. Choose a new name, or enable replacement and click Upload again.')
  }
}

export function validateAppName(value: string) {
  const name = value.trim()
  if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(name)) throw new Error('Use 1 to 48 lowercase letters, numbers, hyphens, or underscores for the app name.')
  if (name === 'menu' || name === 'startup') throw new Error('Menu and Startup are protected. Choose another app name.')
  return name
}

export async function uploadEditorApp(root: DiskDirectory, value: string, code: string, replace = false) {
  const name = validateAppName(value)
  const appsRoot = await root.getDirectoryHandle('apps')
  let appRoot: DiskDirectory | null = null
  try {
    appRoot = await appsRoot.getDirectoryHandle(name)
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error
  }
  if (appRoot && !replace) throw new ExistingAppError()
  const created = !appRoot
  appRoot ??= await appsRoot.getDirectoryHandle(name, { create: true })
  let previousCode: string | null = null
  try {
    previousCode = await (await (await appRoot.getFileHandle('__init__.py')).getFile()).text()
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
      if (created) await appsRoot.removeEntry(name, { recursive: true }).catch(() => undefined)
      throw error
    }
  }
  const writeCode = async (text: string) => {
    const fileHandle = await appRoot.getFileHandle('__init__.py', { create: true })
    const writable = await fileHandle.createWritable()
    try {
      await writable.write(text)
      await writable.close()
    } catch (error) {
      await writable.abort().catch(() => undefined)
      throw error
    }
    const saved = await (await fileHandle.getFile()).text()
    if (saved !== text) throw new Error('Upload did not pass read-back verification.')
  }
  try {
    await writeCode(code)
  } catch (error) {
    if (previousCode !== null) {
      try { await writeCode(previousCode) } catch { throw new Error('Upload failed and the previous file could not be restored. Reconnect BADGER and copy your downloaded code manually.') }
    } else {
      try {
        if (created) await appsRoot.removeEntry(name, { recursive: true })
        else await appRoot.removeEntry('__init__.py')
      } catch {
        throw new Error('Upload failed and the incomplete file could not be removed. Check the app folder on BADGER before restarting.')
      }
    }
    throw error
  }
  return `/apps/${name}/__init__.py`
}


export async function uploadEditorProject(root: DiskDirectory, project: EditorProject, options: { replace?: boolean; expected?: Map<string, Uint8Array> } = {}) {
  const name = validateAppName(project.name)
  validateProjectLocation(project)
  if (!project.files.some(file => file.path === '__init__.py' && file.text !== null)) throw new Error('The app needs an editable __init__.py.')
  const paths = new Set<string>()
  for (const file of project.files) {
    validateFilePath(file.path)
    if (paths.has(file.path)) throw new Error(`Duplicate file: ${file.path}`)
    paths.add(file.path)
  }
  const appsRoot = await root.getDirectoryHandle('apps')
  let appRoot: DiskDirectory | null = null
  try { appRoot = await appsRoot.getDirectoryHandle(name) } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error
  }
  if (appRoot && !options.replace && !options.expected) throw new ExistingAppError()
  if (!appRoot && options.expected) throw new Error('The app was removed from the badge. Refresh the badge files before uploading.')
  const created = !appRoot
  appRoot ??= await appsRoot.getDirectoryHandle(name, { create: true })
  const directory = async (path: string, create: boolean) => {
    const parts = path.split('/')
    const filename = parts.pop()!
    let current = appRoot!
    for (const part of parts) current = await current.getDirectoryHandle(part, { create })
    return { directory: current, filename }
  }
  const read = async (path: string) => {
    try {
      const target = await directory(path, false)
      return new Uint8Array(await (await (await target.directory.getFileHandle(target.filename)).getFile()).arrayBuffer())
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return null
      throw error
    }
  }
  const write = async (path: string, bytes: Uint8Array) => {
    const target = await directory(path, true)
    const handle = await target.directory.getFileHandle(target.filename, { create: true })
    const writable = await handle.createWritable()
    try {
      await writable.write(bytes)
      await writable.close()
    } catch (error) {
      await writable.abort().catch(() => undefined)
      throw error
    }
    const saved = new Uint8Array(await (await handle.getFile()).arrayBuffer())
    if (!bytesEqual(bytes, saved)) throw new Error(`${path} did not pass read-back verification.`)
  }
  const plan: { path: string; data: Uint8Array; before: Uint8Array | null }[] = []
  const attempted: typeof plan = []
  try {
    for (const file of project.files) {
      const data = fileBytes(file)
      const baseline = options.expected?.get(file.path)
      if (options.expected && baseline && bytesEqual(baseline, data)) continue
      const before = await read(file.path)
      if (options.expected && (baseline ? !before || !bytesEqual(baseline, before) : before !== null)) {
        throw new Error(`${file.path} changed on the badge since it was opened. Refresh and reload the app before uploading.`)
      }
      if (!before || !bytesEqual(before, data)) plan.push({ path: file.path, data, before })
    }
    for (const item of plan.sort((a, b) => Number(a.path === '__init__.py') - Number(b.path === '__init__.py'))) {
      attempted.push(item)
      await write(item.path, item.data)
    }
  } catch (error) {
    try {
      if (created) await appsRoot.removeEntry(name, { recursive: true })
      else for (const item of [...attempted].reverse()) {
        if (item.before !== null) await write(item.path, item.before)
        else {
          const target = await directory(item.path, false)
          try { await target.directory.removeEntry(target.filename) } catch (removeError) {
            if (!(removeError instanceof DOMException && removeError.name === 'NotFoundError')) throw removeError
          }
        }
      }
    } catch { throw new Error('Upload failed and rollback could not finish. Check the app files on BADGER before restarting.') }
    throw error
  }
  return { path: `/apps/${name}`, written: plan.length }
}
