import { useEffect, useRef, useState } from 'react'
import { Check, CircleAlert, Eye, EyeOff, FileCode2, FolderUp, LoaderCircle, LogOut, PlugZap, RefreshCw, RotateCcw, ShoppingBag, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

declare module 'react' {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string
  }
}

type SerialPortLike = {
  open: (options: { baudRate: number }) => Promise<void>
  close: () => Promise<void>
  readable?: ReadableStream<Uint8Array>
  writable?: WritableStream<Uint8Array>
}

type DiskFileHandle = {
  getFile: () => Promise<File>
  createWritable: () => Promise<{ write: (value: string | ArrayBuffer | Uint8Array) => Promise<void>; close: () => Promise<void> }>
}

type DiskEntry = {
  kind: 'file' | 'directory'
  name: string
  getFile?: () => Promise<File>
}

type DiskDirectoryHandle = {
  name: string
  values: () => AsyncIterableIterator<DiskEntry>
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<DiskDirectoryHandle>
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<DiskFileHandle>
  removeEntry: (name: string, options?: { recursive?: boolean }) => Promise<void>
}

type AppFile = {
  file: File
  relativePath: string
}

type PendingApp = {
  name: string
  files: AppFile[]
}

type DeviceApp = {
  name: string
  size: number
  writable: boolean
}

type StoreApp = {
  name: string
  title: string
  files: string[]
  iconUrl?: string
}

type AutosaveState = 'saved' | 'pending' | 'saving' | 'error'

type DroppedEntry = {
  isFile: boolean
  isDirectory: boolean
  name: string
  file?: (success: (file: File) => void, failure?: (error: DOMException) => void) => void
  createReader?: () => { readEntries: (success: (entries: DroppedEntry[]) => void, failure?: (error: DOMException) => void) => void }
}

declare global {
  interface Navigator {
    serial?: {
      requestPort: () => Promise<SerialPortLike>
    }
  }

  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<DiskDirectoryHandle>
  }
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const appsTreeUrl = 'https://api.github.com/repos/badger/home/git/trees/main?recursive=1'

function titleForApp(name: string) {
  return name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function base64(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value
  let result = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    result += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(result)
}

function appName(value: string) {
  return value
    .replace(/\\/g, '/')
    .split('/')[0]
    .replace(/\.py$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'new-app'
}

function normalizeFiles(files: FileList | File[]) {
  return Array.from(files).map((file) => ({
    file,
    relativePath: file.webkitRelativePath || file.name,
  }))
}

function makePendingApps(files: AppFile[]) {
  const grouped = new Map<string, AppFile[]>()
  for (const entry of files) {
    const key = appName(entry.relativePath)
    grouped.set(key, [...(grouped.get(key) ?? []), entry])
  }
  return [...grouped.entries()].map(([name, appFiles]) => ({ name, files: appFiles }))
}

async function collectDroppedFiles(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer.items)
  const entries = items
    .map((item) => (item as unknown as { webkitGetAsEntry?: () => DroppedEntry | null }).webkitGetAsEntry?.())
    .filter((entry): entry is DroppedEntry => Boolean(entry))
  if (!entries.length) return normalizeFiles(dataTransfer.files)

  async function readAll(reader: NonNullable<DroppedEntry['createReader']> extends () => infer T ? T : never) {
    const result: DroppedEntry[] = []
    while (true) {
      const batch = await new Promise<DroppedEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
      if (!batch.length) return result
      result.push(...batch)
    }
  }

  async function visit(entry: DroppedEntry, prefix = ''): Promise<AppFile[]> {
    if (entry.isFile && entry.file) {
      const file = await new Promise<File>((resolve, reject) => entry.file?.(resolve, reject))
      return [{ file, relativePath: `${prefix}${entry.name}` }]
    }
    if (!entry.isDirectory || !entry.createReader) return []
    const children = await readAll(entry.createReader())
    const nested = await Promise.all(children.map((child) => visit(child, `${prefix}${entry.name}/`)))
    return nested.flat()
  }

  return (await Promise.all(entries.map((entry) => visit(entry)))).flat()
}

export function BadgeManager() {
  const [port, setPort] = useState<SerialPortLike | null>(null)
  const portRef = useRef<SerialPortLike | null>(null)
  const [diskRoot, setDiskRoot] = useState<DiskDirectoryHandle | null>(null)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Connect a badge running MicroPython.')
  const [output, setOutput] = useState('')
  const [apps, setApps] = useState<DeviceApp[]>([])
  const [storeApps, setStoreApps] = useState<StoreApp[]>([])
  const [storeMessage, setStoreMessage] = useState('Loading apps from badger/home…')
  const [pendingApps, setPendingApps] = useState<PendingApp[]>([])
  const [removeQueue, setRemoveQueue] = useState<string[]>([])
  const [secrets, setSecrets] = useState('')
  const [initialSecrets, setInitialSecrets] = useState('')
  const [secretsDirty, setSecretsDirty] = useState(false)
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('saved')
  const [secretsVisible, setSecretsVisible] = useState(false)
  const [showAppsPrompt, setShowAppsPrompt] = useState(false)
  const [dragging, setDragging] = useState(false)
  const outputRef = useRef('')
  const serialResponseRef = useRef('')
  const serialAppsRootRef = useRef('/apps')
  const secretsRef = useRef('')
  const lastSavedSecretsRef = useRef('')
  const failedSecretsRef = useRef<string | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const abortReaderRef = useRef(false)
  const pickerRef = useRef<HTMLInputElement>(null)
  const appStoreRef = useRef<HTMLElement>(null)

  useEffect(() => {
    return () => {
      if (!port) return
      abortReaderRef.current = true
      if (portRef.current === port) portRef.current = null
      void (async () => {
        await readerRef.current?.cancel().catch(() => undefined)
        readerRef.current = null
        await port?.close().catch(() => undefined)
      })()
    }
  }, [port])

  useEffect(() => {
    void loadStore()
  }, [])

  useEffect(() => {
    if (!connected || busy || !secretsDirty || lastSavedSecretsRef.current === secrets || failedSecretsRef.current === secrets) return
    const timer = window.setTimeout(() => void saveSecrets(secrets), 700)
    return () => window.clearTimeout(timer)
  }, [autosaveState, busy, connected, secrets, secretsDirty])

  function appendOutput(value: string) {
    serialResponseRef.current += value
    outputRef.current = `${outputRef.current}${value}`.slice(-12000)
    setOutput(outputRef.current)
  }

  function clearBadgeData() {
    setApps([])
    setRemoveQueue([])
    setSecrets('')
    setInitialSecrets('')
    setSecretsDirty(false)
    setAutosaveState('saved')
    setSecretsVisible(false)
    setShowAppsPrompt(false)
    setOutput('')
    outputRef.current = ''
    serialResponseRef.current = ''
    secretsRef.current = ''
    lastSavedSecretsRef.current = ''
    failedSecretsRef.current = null
  }

  function loadSecrets(value: string) {
    setSecrets(value)
    setInitialSecrets(value)
    setSecretsDirty(false)
    setAutosaveState('saved')
    secretsRef.current = value
    lastSavedSecretsRef.current = value
    failedSecretsRef.current = null
  }

  function updateSecrets(value: string) {
    setSecrets(value)
    secretsRef.current = value
    failedSecretsRef.current = null
    const dirty = value !== lastSavedSecretsRef.current
    setSecretsDirty(dirty)
    setAutosaveState(dirty ? 'pending' : 'saved')
  }

  function revertSecrets() {
    updateSecrets(initialSecrets)
  }

  function retrySecrets() {
    failedSecretsRef.current = null
    setAutosaveState('pending')
    setSecretsDirty(secretsRef.current !== lastSavedSecretsRef.current)
  }

  async function releaseSerial(statusMessage: string, activePort = portRef.current) {
    abortReaderRef.current = true
    if (activePort?.writable && portRef.current === activePort) {
      const writer = activePort.writable.getWriter()
      try {
        await writer.write(encoder.encode('\u0002'))
      } catch {
        setStatus(statusMessage)
      } finally {
        writer.releaseLock()
      }
      await new Promise((resolve) => window.setTimeout(resolve, 150))
    }
    portRef.current = null
    await readerRef.current?.cancel().catch(() => undefined)
    readerRef.current = null
    await activePort?.close().catch(() => undefined)
    setPort(null)
    setDiskRoot(null)
    setConnected(false)
    clearBadgeData()
    setStatus(statusMessage)
  }

  function ejectDisk(statusMessage = 'BADGER was released from the editor. Use your computer’s eject control before unplugging it.') {
    setDiskRoot(null)
    setPort(null)
    portRef.current = null
    setConnected(false)
    clearBadgeData()
    setStatus(statusMessage)
  }

  async function loadStore() {
    try {
      const response = await fetch(appsTreeUrl)
      if (!response.ok) throw new Error()
      const payload = await response.json() as { tree?: Array<{ path: string; type: string }> }
      const folders = new Map<string, string[]>()
      for (const entry of payload.tree ?? []) {
        if (entry.type !== 'blob' || !entry.path.startsWith('badge/apps/')) continue
        if (entry.path.includes('/__pycache__/') || entry.path.endsWith('.pyc') || entry.path.endsWith('/.DS_Store')) continue
        const [, , name, ...filePath] = entry.path.split('/')
        if (!name || !filePath.length || name === 'menu' || name === 'startup') continue
        folders.set(name, [...(folders.get(name) ?? []), filePath.join('/')])
      }
      const loadedApps = [...folders.entries()]
        .filter(([, files]) => files.includes('__init__.py'))
        .map(([name, files]) => ({
          name,
          title: titleForApp(name),
          files: files.sort(),
          iconUrl: files.includes('icon.png') ? `https://raw.githubusercontent.com/badger/home/main/badge/apps/${name}/icon.png` : undefined,
        }))
        .sort((left, right) => left.title.localeCompare(right.title))
      setStoreApps(loadedApps)
      setStoreMessage(`${loadedApps.length} apps · source: badger/home`)
    } catch {
      setStoreMessage('Could not load the app catalog. Try again.')
    }
  }

  async function startReader(activePort: SerialPortLike) {
    if (!activePort.readable) throw new Error('This serial port has no readable stream.')
    const reader = activePort.readable.getReader()
    readerRef.current = reader
    abortReaderRef.current = false
    try {
      while (!abortReaderRef.current) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) appendOutput(decoder.decode(value))
      }
    } finally {
      reader.releaseLock()
      if (readerRef.current === reader) readerRef.current = null
    }
  }

  async function write(value: string) {
    const activePort = portRef.current
    if (!activePort?.writable) throw new Error('No writable serial connection. If the badge is in disk mode, choose Open BADGER disk instead.')
    const writer = activePort.writable.getWriter()
    try {
      await writer.write(encoder.encode(value))
    } finally {
      writer.releaseLock()
    }
  }

  async function waitForSerial(predicate: (value: string) => boolean, timeout = 5000) {
    const until = Date.now() + timeout
    while (Date.now() < until) {
      const response = serialResponseRef.current
      if (predicate(response)) return response
      await new Promise((resolve) => window.setTimeout(resolve, 30))
    }
    throw new Error(`The badge did not answer within ${Math.ceil(timeout / 1000)} seconds.`)
  }

  async function rawExec(code: string, timeout = 7000) {
    serialResponseRef.current = ''
    await write('\r\u0002\u0003\u0003')
    await new Promise((resolve) => window.setTimeout(resolve, 100))
    serialResponseRef.current = ''
    await write('\r\u0001')
    try {
      await waitForSerial((response) => response.includes('raw REPL') && response.includes('>'))
    } catch {
      throw new Error('Chrome opened the serial port, but MicroPython did not answer. Reboot the badge normally instead of using disk mode, then reconnect serial.')
    }
    serialResponseRef.current = ''
    const preparedCode = `import sys;sys.path[:]=[p for p in sys.path if p is not None]\n${code}`
    await write(`${preparedCode.endsWith('\n') ? preparedCode : `${preparedCode}\n`}\u0004`)
    const response = await waitForSerial((value) => value.split('\u0004').length >= 3, timeout)
    const body = response.replace(/^OK/, '')
    const [stdout = '', stderr = ''] = body.split('\u0004')
    if (stderr.trim()) throw new Error(stderr.trim())
    return stdout.trim()
  }

  async function run(task: () => Promise<void>) {
    setBusy(true)
    try {
      await task()
      return true
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The badge operation failed.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function connect() {
    await run(async () => {
      if (!navigator.serial) throw new Error('Web Serial is available in Chromium browsers over HTTPS or localhost.')
      const selectedPort = await navigator.serial.requestPort()
      try {
        await selectedPort.open({ baudRate: 115200 })
      } catch {
        throw new Error('Chrome found the badge but could not open it. Close any other badge editor or serial monitor, reconnect the USB cable, and try again.')
      }
      if (!selectedPort.readable || !selectedPort.writable) {
        await selectedPort.close().catch(() => undefined)
        throw new Error('This is not an active MicroPython serial interface. For disk mode, choose Open BADGER disk.')
      }
      portRef.current = selectedPort
      setPort(selectedPort)
      setDiskRoot(null)
      setConnected(true)
      void startReader(selectedPort).then(() => {
        if (portRef.current === selectedPort) void releaseSerial('Badge disconnected.', selectedPort)
      }).catch((error) => {
        if (portRef.current === selectedPort) void releaseSerial(error instanceof Error ? error.message : 'The serial reader stopped.', selectedPort)
      })
      setStatus('Connected. Reading the badge filesystem…')
      await new Promise((resolve) => window.setTimeout(resolve, 100))
      await refresh(selectedPort)
    })
  }

  async function connectDisk() {
    await run(async () => {
      if (!window.showDirectoryPicker) throw new Error('Disk mode needs a current Chrome or Edge window over HTTPS or localhost.')
      const root = await window.showDirectoryPicker({ mode: 'readwrite' })
      setDiskRoot(root)
      portRef.current = null
      setPort(null)
      setConnected(true)
      await refreshDisk(root)
    })
  }

  async function disconnect() {
    await releaseSerial('Disconnected.')
  }

  async function refresh(activePort = port) {
    if (diskRoot) {
      await refreshDisk(diskRoot)
      return
    }
    if (!activePort) return
    await run(async () => {
      const appPayload = await rawExec("import os\nfor root,kind in (('/system/apps','S'),('/apps','U')):\n try: entries=os.listdir(root)\n except OSError: entries=[]\n for n in entries:\n  if isinstance(n,str):\n   try:\n    os.listdir(root+'/'+n)\n    print('__BADGER_APP__'+kind+':'+n)\n   except OSError: pass")
      const secretPayload = await rawExec("import ubinascii;\ntry:\n f=open('/secrets.py','rb');print(ubinascii.b2a_base64(f.read()).decode().strip());f.close()\nexcept OSError: print('')")
      const appLines = appPayload.split(/\r?\n/).map((name) => name.trim()).filter(Boolean)
      const found = new Map<string, DeviceApp>()
      for (const line of appLines) {
        if (!line.startsWith('__BADGER_APP__')) continue
        const payload = line.slice('__BADGER_APP__'.length)
        const kind = payload.slice(0, 1)
        const name = payload.slice(2)
        if (!name || name === 'menu' || name === 'startup') continue
        found.set(name, { name, size: 0, writable: kind === 'U' })
      }
      const discoveredApps = [...found.values()].sort((left, right) => left.name.localeCompare(right.name))
      setApps(discoveredApps)
      loadSecrets(secretPayload ? decoder.decode(Uint8Array.from(atob(secretPayload), (char) => char.charCodeAt(0))) : '')
      setStatus(`${discoveredApps.length} app${discoveredApps.length === 1 ? '' : 's'} found in Serial mode.`)
    })
  }

  async function refreshDisk(root: DiskDirectoryHandle) {
    await run(async () => {
      const appsRoot = await root.getDirectoryHandle('apps')
      const found: DeviceApp[] = []
      for await (const entry of appsRoot.values()) {
        if (entry.kind !== 'directory') continue
        try {
          const appRoot = await appsRoot.getDirectoryHandle(entry.name)
          await appRoot.getFileHandle('__init__.py')
          let size = 0
          for await (const file of appRoot.values()) {
            if (file.kind === 'file' && file.getFile) size += (await file.getFile()).size
          }
          found.push({ name: entry.name, size, writable: true })
        } catch {
          continue
        }
      }
      setApps(found.sort((left, right) => left.name.localeCompare(right.name)))
      try {
        const secretFile = await root.getFileHandle('secrets.py')
        loadSecrets(await (await secretFile.getFile()).text())
      } catch {
        loadSecrets('')
      }
      setStatus(`BADGER disk ${root.name} is connected.`)
    })
  }

  function stageFiles(files: AppFile[]) {
    const additions = makePendingApps(files)
    setPendingApps((current) => {
      const next = new Map(current.map((item) => [item.name, item]))
      for (const app of additions) next.set(app.name, app)
      return [...next.values()]
    })
    setStatus(`${additions.length} app${additions.length === 1 ? '' : 's'} ready to upload.`)
  }

  function addFiles(files: FileList | File[]) {
    stageFiles(normalizeFiles(files))
  }

  async function addStoreApp(app: StoreApp) {
    setStatus(`Getting ${app.title} from badger/home…`)
    const files = await Promise.all(app.files.map(async (path) => {
      const response = await fetch(`https://raw.githubusercontent.com/badger/home/main/badge/apps/${app.name}/${path}`)
      if (!response.ok) throw new Error(`Could not get ${app.title} from the app store.`)
      const contents = await response.blob()
      return { file: new File([contents], path.split('/').at(-1) ?? path), relativePath: `${app.name}/${path}` }
    }))
    setPendingApps((current) => [...current.filter((item) => item.name !== app.name), { name: app.name, files }])
    setStatus(`${app.title} is ready to upload.`)
  }

  async function installApps() {
    await run(async () => {
      if (!pendingApps.length) return
      const appCount = pendingApps.length
      setStatus('Preparing app upload…')
      const secretsToSave = secretsRef.current
      if (secretsToSave !== lastSavedSecretsRef.current) {
        await writeSecrets(secretsToSave)
        lastSavedSecretsRef.current = secretsToSave
        failedSecretsRef.current = null
        setSecretsDirty(false)
        setAutosaveState('saved')
      }
      if (diskRoot) {
        const appsRoot = await diskRoot.getDirectoryHandle('apps', { create: true })
        for (const app of pendingApps) {
          const appRoot = await appsRoot.getDirectoryHandle(app.name, { create: true })
          for (const [index, entry] of app.files.entries()) {
            setStatus(`Uploading ${app.name} · ${index + 1} of ${app.files.length}`)
            const sourcePath = entry.relativePath.replace(/\\/g, '/')
            const relativePath = sourcePath.includes('/') ? sourcePath.split('/').slice(1).join('/') : '__init__.py'
            const parts = relativePath.split('/').filter(Boolean)
            const fileName = parts.pop()
            if (!fileName) continue
            let directory = appRoot
            for (const part of parts) directory = await directory.getDirectoryHandle(part, { create: true })
            const writable = await (await directory.getFileHandle(fileName, { create: true })).createWritable()
            await writable.write(await entry.file.arrayBuffer())
            await writable.close()
          }
        }
        setPendingApps([])
        ejectDisk(`${appCount} app${appCount === 1 ? '' : 's'} uploaded and the BADGER session was released. Use your computer’s eject control before unplugging it, then reboot the badge.`)
        return
      }
      const appsRoot = serialAppsRootRef.current
      await rawExec(`import os\ntry: os.listdir(${JSON.stringify(appsRoot)})\nexcept OSError: os.mkdir(${JSON.stringify(appsRoot)})`)
      for (const app of pendingApps) {
        const appRoot = `${appsRoot}/${app.name}`
        await rawExec(`import os\ntry: os.mkdir(${JSON.stringify(appRoot)})\nexcept OSError: pass`)
        for (const [index, entry] of app.files.entries()) {
          setStatus(`Uploading ${app.name} · ${index + 1} of ${app.files.length}`)
          const sourcePath = entry.relativePath.replace(/\\/g, '/')
          const relativePath = sourcePath.includes('/') ? sourcePath.split('/').slice(1).join('/') : '__init__.py'
          const parts = relativePath.split('/').filter(Boolean)
          const fileName = parts.pop()
          if (!fileName) continue
          let directory = appRoot
          for (const part of parts) {
            directory = `${directory}/${part}`
            await rawExec(`import os\ntry: os.mkdir(${JSON.stringify(directory)})\nexcept OSError: pass`)
          }
          const destination = `${directory}/${fileName}`
          const bytes = new Uint8Array(await entry.file.arrayBuffer())
          await rawExec(`f=open(${JSON.stringify(destination)},'wb');f.close()`)
          for (let offset = 0; offset < bytes.length; offset += 384) {
            const chunk = bytes.subarray(offset, offset + 384)
            await rawExec(`import ubinascii;f=open(${JSON.stringify(destination)},'ab');f.write(ubinascii.a2b_base64('${base64(chunk)}'));f.close()`)
          }
        }
      }
      setPendingApps([])
      await releaseSerial(`${appCount} app${appCount === 1 ? '' : 's'} uploaded and the serial link was closed. Restart the badge to refresh its launcher.`)
    })
  }

  async function removeApps() {
    await run(async () => {
      if (!removeQueue.length) return
      if (diskRoot) {
        const appsRoot = await diskRoot.getDirectoryHandle('apps')
        for (const name of removeQueue) await appsRoot.removeEntry(name, { recursive: true })
        setRemoveQueue([])
        setStatus('Apps removed from the BADGER disk. Eject it, then reboot the badge.')
        await refreshDisk(diskRoot)
        return
      }
      for (const name of removeQueue) {
        const target = `${serialAppsRootRef.current}/${name}`
        const result = await rawExec(`import os\ndef r(p):\n try: xs=os.listdir(p)\n except OSError:\n  try: os.remove(p)\n  except OSError: pass\n  return\n for x in xs:\n  if x!='.' and x!='..': r(p+'/'+x)\n try: os.rmdir(p)\n except OSError: pass\np=${JSON.stringify(target)}\nr(p)\ntry: os.stat(p);print('__BADGER_REMOVE_FAILED__')\nexcept OSError: print('__BADGER_REMOVE_OK__')`)
        if (!result.includes('__BADGER_REMOVE_OK__')) throw new Error(`Could not remove ${name}. Restart the badge and try again.`)
      }
      setRemoveQueue([])
      setStatus('Apps removed. Restart the badge to refresh its launcher.')
      await refresh()
    })
  }

  async function writeSecrets(value: string) {
    if (diskRoot) {
      const writable = await (await diskRoot.getFileHandle('secrets.py', { create: true })).createWritable()
      await writable.write(value)
      await writable.close()
      return
    }
    const encoded = base64(value)
    await rawExec(`import ubinascii;f=open('/secrets.py','wb');f.write(ubinascii.a2b_base64('${encoded}'));f.close()`)
  }

  async function saveSecrets(value = secretsRef.current) {
    setBusy(true)
    setAutosaveState('saving')
    try {
      await writeSecrets(value)
      lastSavedSecretsRef.current = value
      failedSecretsRef.current = null
      const stillDirty = secretsRef.current !== value
      setSecretsDirty(stillDirty)
      setAutosaveState(stillDirty ? 'pending' : 'saved')
      setShowAppsPrompt(true)
      setStatus('Secrets saved automatically. Add any new apps, then upload them to finish.')
    } catch (error) {
      failedSecretsRef.current = value
      setAutosaveState('error')
      setStatus(error instanceof Error ? error.message : 'Could not save secrets.py automatically.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="badge-edit-root mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-primary/20 bg-card/80 p-6 shadow-lg backdrop-blur sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-primary"><PlugZap className="h-4 w-4" /> Device link</div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Badger Edit</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Manage a connected badge from the browser. Nothing is sent until you choose an action.</p>
          </div>
          {connected ? diskRoot ? <Button onClick={() => ejectDisk()} variant="outline"><LogOut /> Eject</Button> : <Button onClick={disconnect} variant="outline">Disconnect</Button> : <div className="flex flex-wrap gap-2"><Button onClick={connect} disabled={busy}><PlugZap /> Connect serial</Button><Button onClick={connectDisk} variant="outline" disabled={busy}><FolderUp /> Open BADGER disk</Button></div>}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg bg-background/70 px-4 py-3 font-mono text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-primary shadow-[0_0_12px_rgba(95,237,131,0.9)]' : 'bg-muted-foreground'}`} />
          <span className="min-w-0 flex-1">{status}</span>
          {connected && <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs text-primary">{diskRoot ? 'Disk mode' : 'Serial mode'}</span>}
        </div>
      </section>

      <div className={`grid gap-6 ${connected ? 'lg:grid-cols-[1.05fr_0.95fr]' : ''}`}>
        <section ref={appStoreRef} className="rounded-2xl border border-border/50 bg-card/80 p-6 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-xl font-semibold">App store</h2><p className="mt-1 text-sm text-muted-foreground">{storeMessage}</p></div>
            <Button size="sm" variant="outline" onClick={() => void loadStore()} disabled={busy}><RefreshCw /> Reload</Button>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {storeApps.map((app) => {
              const queued = pendingApps.some((item) => item.name === app.name)
              return <div key={app.name} className="rounded-xl border border-border/50 bg-background/45 p-3"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3">{app.iconUrl ? <img src={app.iconUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" /> : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10"><FileCode2 className="h-5 w-5 text-primary" /></div>}<h3 className="text-sm font-medium">{app.title}</h3></div><Button size="sm" variant={queued ? 'secondary' : 'outline'} onClick={() => void run(() => addStoreApp(app))} disabled={busy}>{queued ? <><Check /> Added</> : <><ShoppingBag /> Add</>}</Button></div></div>
            })}
          </div>
          {!storeApps.length && <p className="mt-5 text-sm text-muted-foreground">The catalog loads from GitHub when this page opens.</p>}
          <input ref={pickerRef} type="file" className="hidden" multiple webkitdirectory="" onChange={(event) => event.target.files && addFiles(event.target.files)} />
          <p className="mt-6 text-sm text-muted-foreground">Or add your own app source.</p>
          <button onClick={() => pickerRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void collectDroppedFiles(event.dataTransfer).then(stageFiles) }} className={`mt-5 flex w-full flex-col items-center justify-center rounded-xl border border-dashed px-5 py-9 text-center transition ${dragging ? 'border-primary bg-primary/10' : 'border-border/70 bg-background/40 hover:border-primary/60'}`}>
            <FolderUp className="mb-3 h-7 w-7 text-primary" />
            <span className="font-mono text-sm">Drop an app folder here</span><span className="mt-1 text-xs text-muted-foreground">or select its source files</span>
          </button>
          {pendingApps.length > 0 && <div className="mt-5 space-y-2">{pendingApps.map((app) => <div key={app.name} className="flex items-center justify-between rounded-lg bg-background/60 px-3 py-2 text-sm"><span className="flex items-center gap-2"><FileCode2 className="h-4 w-4 text-primary" />{app.name}<span className="text-muted-foreground">Ready to upload</span></span><button onClick={() => setPendingApps((current) => current.filter((item) => item.name !== app.name))} className="text-muted-foreground hover:text-foreground">Remove</button></div>)}</div>}
          <Button className="mt-5 w-full" onClick={installApps} disabled={!connected || !pendingApps.length || busy}><Upload /> Upload {pendingApps.length ? `${pendingApps.length} app${pendingApps.length === 1 ? '' : 's'}` : 'staged apps'}</Button>
          {connected && <div className="mt-7 border-t border-border/40 pt-5"><h3 className="text-sm font-medium">Apps on badge</h3><div className="mt-3 space-y-2">{apps.length ? apps.map((app) => app.writable ? <label key={app.name} className="flex cursor-pointer items-center justify-between rounded-lg bg-background/45 px-3 py-2 text-sm"><span>{app.name} <span className="text-muted-foreground">{app.size ? `${Math.ceil(app.size / 1024)} KB` : 'Uploaded'}</span></span><input type="checkbox" checked={removeQueue.includes(app.name)} onChange={() => setRemoveQueue((current) => current.includes(app.name) ? current.filter((name) => name !== app.name) : [...current, app.name])} /></label> : <div key={app.name} className="flex items-center justify-between rounded-lg bg-background/45 px-3 py-2 text-sm"><span>{app.name}</span><span className="font-mono text-xs text-muted-foreground">Built in</span></div>) : <p className="text-sm text-muted-foreground">No apps found.</p>}</div><Button className="mt-4 w-full" variant="destructive" onClick={removeApps} disabled={!removeQueue.length || busy}><Trash2 /> Remove {removeQueue.length || ''} selected</Button></div>}
        </section>

        {connected && <section className="rounded-2xl border border-border/50 bg-card/80 p-6 shadow-lg">
          <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><FileCode2 className="mt-1 h-5 w-5 text-primary" /><div><h2 className="text-xl font-semibold">secrets.py</h2><p className="mt-1 text-sm text-muted-foreground">Loaded only while this badge is connected. Hidden by default.</p></div></div><button type="button" onClick={() => setSecretsVisible((current) => !current)} className="rounded-lg border border-border/60 p-2 text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground" aria-label={secretsVisible ? 'Hide secrets' : 'Show secrets'} title={secretsVisible ? 'Hide secrets' : 'Show secrets'}>{secretsVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
          <textarea value={secretsVisible ? secrets : secrets.replace(/[^\r\n]/g, '•')} onChange={(event) => updateSecrets(event.target.value)} readOnly={!secretsVisible} spellCheck="false" placeholder={'WIFI_SSID = "..."\nWIFI_PASSWORD = "..."'} className="mt-5 min-h-[360px] w-full resize-y rounded-xl border border-border/60 bg-black/30 p-4 font-mono text-sm leading-6 text-foreground outline-none transition focus:border-primary/70 focus:ring-1 focus:ring-primary/30" />
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className={`flex items-center gap-2 font-mono text-xs ${autosaveState === 'error' ? 'text-red-300' : 'text-muted-foreground'}`}>{autosaveState === 'saving' ? <LoaderCircle className="h-4 w-4 animate-spin text-primary" /> : autosaveState === 'error' ? <CircleAlert className="h-4 w-4" /> : <Check className="h-4 w-4 text-primary" />}{autosaveState === 'pending' ? 'Saving shortly…' : autosaveState === 'saving' ? 'Saving automatically…' : autosaveState === 'error' ? 'Autosave failed' : 'Saved automatically'}</span>
            <div className="flex gap-2">{autosaveState === 'error' && <Button size="sm" variant="outline" onClick={retrySecrets} disabled={busy}>Retry</Button>}<Button size="sm" variant="outline" onClick={revertSecrets} disabled={secrets === initialSecrets || autosaveState === 'saving'} title="Restore secrets.py to the version loaded when this badge connected"><RotateCcw /> Revert</Button></div>
          </div>
          {showAppsPrompt && <div className="mt-5 rounded-lg border border-primary/25 bg-primary/5 p-4"><p className="text-sm font-medium text-foreground">Next, add the latest apps.</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Choose apps from the catalog or drop your own folder, then upload. The editor will release the badge when the upload finishes.</p><Button className="mt-3" size="sm" variant="outline" onClick={() => appStoreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><Upload /> Choose apps</Button></div>}
          {diskRoot && <div className="mt-5 flex gap-3 rounded-lg bg-primary/5 p-4 text-sm text-muted-foreground"><CircleAlert className="h-5 w-5 shrink-0 text-primary" /><p>All writes are closed before the editor releases BADGER. Use your computer’s eject control before unplugging the USB cable.</p></div>}
        </section>}
      </div>

      {connected && port && <details className="rounded-xl border border-border/50 bg-card/65 px-5 py-4"><summary className="cursor-pointer font-mono text-sm">Serial console</summary><pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-black/35 p-4 font-mono text-xs text-muted-foreground">{output || 'Waiting for serial output.'}</pre></details>}
      {busy && autosaveState !== 'saving' && <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 backdrop-blur-sm"><div className="flex max-w-md items-center gap-3 rounded-xl border border-primary/30 bg-card px-5 py-4 font-mono text-sm shadow-xl"><LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-primary" /> {status}</div></div>}
    </div>
  )
}
