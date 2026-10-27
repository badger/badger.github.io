import { useEffect, useRef, useState } from 'react'
import { Check, CircleAlert, FileCode2, FolderUp, LoaderCircle, LogOut, PlugZap, RefreshCw, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BadgeSetupGuide } from '@/components/badge-setup-guide'
import { StoreAppCard } from '@/components/store-app-card'
import { SERIAL_CONNECTION_MODE_ENABLED } from '@/config/features'
import { PREINSTALLED_APPS_BY_STORE_ID } from '@/data/preinstalled-apps'
import { appFileUrl, fetchAppCatalog } from '@/lib/github-app-catalog'

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
  source: 'store' | 'local'
}

type DeviceApp = {
  name: string
  size: number
  firmware: boolean
}

type StoreApp = {
  name: string
  title: string
  files: string[]
  revision: string
  iconUrl?: string
  iconColor?: string
  description?: string
}

type OperationResult = {
  tone: 'success' | 'error'
  message: string
}

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

const serialAppsRoot = '/apps'
const launcherStart = '\n_BADGER_WEB_MENU_V4 = True\n'
const launcherEnd = '\n_BADGER_WEB_MENU_V4_END = True\n'
const launcherBootMarker = '__BADGER_WRITABLE_APPS_READY__'

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
  return [...grouped.entries()].map(([name, appFiles]) => ({ name, files: appFiles, source: 'local' as const }))
}

function relativeInstallPath(entry: AppFile) {
  const sourcePath = entry.relativePath.replace(/\\/g, '/')
  return sourcePath.includes('/') ? sourcePath.split('/').slice(1).join('/') : '__init__.py'
}

function remoteRemoveCode(path: string) {
  return `import os\ndef r(p):\n try: xs=os.listdir(p)\n except OSError:\n  try: os.remove(p)\n  except OSError: pass\n  return\n for x in xs:\n  if x!='.' and x!='..': r(p+'/'+x)\n try: os.rmdir(p)\n except OSError: pass\nr(${JSON.stringify(path)})`
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
  const [status, setStatus] = useState(SERIAL_CONNECTION_MODE_ENABLED ? 'Connect a badge running MicroPython.' : 'Open the BADGER disk to add apps to your badge.')
  const [output, setOutput] = useState('')
  const [apps, setApps] = useState<DeviceApp[]>([])
  const [legacyApps, setLegacyApps] = useState<string[]>([])
  const [storeApps, setStoreApps] = useState<StoreApp[]>([])
  const [storeMessage, setStoreMessage] = useState('Loading apps…')
  const [storeLoading, setStoreLoading] = useState(false)
  const [pendingApps, setPendingApps] = useState<PendingApp[]>([])
  const [removeQueue, setRemoveQueue] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<OperationResult | null>(null)
  const [saveResult, setSaveResult] = useState<OperationResult | null>(null)
  const outputRef = useRef('')
  const serialResponseRef = useRef('')
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const abortReaderRef = useRef(false)
  const serialInterruptedRef = useRef(false)
  const pickerRef = useRef<HTMLInputElement>(null)

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

  function appendOutput(value: string) {
    serialResponseRef.current += value
    outputRef.current = `${outputRef.current}${value}`.slice(-12000)
    setOutput(outputRef.current)
  }

  function clearBadgeData() {
    setApps([])
    setLegacyApps([])
    setRemoveQueue([])
    setResult(null)
    setSaveResult(null)
    setOutput('')
    outputRef.current = ''
    serialResponseRef.current = ''
  }

  async function releaseSerial(statusMessage: string, activePort = portRef.current) {
    abortReaderRef.current = true
    if (activePort?.writable && portRef.current === activePort) {
      const wasInterrupted = serialInterruptedRef.current
      const writer = activePort.writable.getWriter()
      try {
        await writer.write(encoder.encode('\u0003\u0004'))
        if (wasInterrupted) {
          await new Promise((resolve) => window.setTimeout(resolve, 350))
          await writer.write(encoder.encode('\u0002\u0004'))
        }
      } catch {
        setStatus(statusMessage)
      } finally {
        writer.releaseLock()
      }
      await new Promise((resolve) => window.setTimeout(resolve, 150))
    }
    portRef.current = null
    serialInterruptedRef.current = false
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

  async function loadStore(refresh = false) {
    setStoreLoading(true)
    setStoreMessage(`${refresh ? 'Reloading' : 'Loading'} apps…`)
    try {
      const catalog = await fetchAppCatalog({ refresh })
      const loadedApps = catalog.apps
        .map(({ name, files, description }) => {
          const preinstalled = PREINSTALLED_APPS_BY_STORE_ID[name]
          return {
            name,
            title: preinstalled?.title ?? titleForApp(name),
            files: files.sort(),
            revision: catalog.revision,
            iconUrl: preinstalled?.iconSrc ?? (files.includes('icon.png') ? appFileUrl(catalog.revision, name, 'icon.png') : undefined),
            iconColor: preinstalled?.color,
            description: description ?? preinstalled?.description,
          }
        })
        .sort((left, right) => left.title.localeCompare(right.title))
      setStoreApps(loadedApps)
      setStoreMessage(`${loadedApps.length} apps${refresh ? ' reloaded' : ''} · source: badger/home`)
    } catch {
      setStoreMessage(storeApps.length
        ? 'Could not reload the app list. The previous list is still available.'
        : 'Could not load the app list. Select Reload to try again.')
    } finally {
      setStoreLoading(false)
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
    try {
      serialInterruptedRef.current = true
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
    } catch (error) {
      await restartSerialBadge().catch(() => undefined)
      throw error
    }
  }

  async function appendSerialText(path: string, value: string) {
    const bytes = encoder.encode(value)
    for (let offset = 0; offset < bytes.length; offset += 384) {
      const chunk = bytes.subarray(offset, offset + 384)
      await rawExec(`import ubinascii;f=open(${JSON.stringify(path)},'ab');f.write(ubinascii.a2b_base64('${base64(chunk)}'));f.close()`)
    }
  }

  async function readSerialText(path: string) {
    const payload = await rawExec(`import ubinascii\ntry:\n f=open(${JSON.stringify(path)},'rb');print('__BADGER_FILE__'+ubinascii.b2a_base64(f.read()).decode().strip());f.close()\nexcept OSError: print('__BADGER_FILE_MISSING__')`)
    const encoded = payload.split(/\r?\n/).find((line) => line.startsWith('__BADGER_FILE__'))?.slice('__BADGER_FILE__'.length)
    if (encoded === undefined) return null
    return decoder.decode(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)))
  }

  async function writeSerialText(path: string, value: string) {
    await rawExec(`f=open(${JSON.stringify(path)},'wb');f.close()`)
    await appendSerialText(path, value)
    const size = encoder.encode(value).length
    const verification = await rawExec(`import os\ntry: os.sync()\nexcept Exception: pass\nprint('__BADGER_SIZE__'+str(os.stat(${JSON.stringify(path)})[6]))`)
    if (!verification.includes(`__BADGER_SIZE__${size}`)) throw new Error(`${path} did not verify after writing.`)
  }

  async function ensureWritableLauncher() {
    const status = await rawExec(`import os\ntry:\n s=os.stat('/apps/menu/__init__.py')[6];f=open('/apps/menu/__init__.py','rb');f.seek(max(0,s-256));t=f.read();f.close();print('__BADGER_MENU_READY__'+('1' if ${JSON.stringify(launcherEnd.trim())} in t.decode() else '0'))\nexcept OSError: print('__BADGER_MENU_READY__0')`)
    if (!status.includes('__BADGER_MENU_READY__1')) {
      const injection = `${launcherStart}_badger_disabled=[]\ntry:\n _badger_file=open('/apps/.disabled','r');_badger_disabled=[_name.strip() for _name in _badger_file.readlines() if _name.strip()];_badger_file.close()\nexcept OSError: pass\n_badger_writable=[]\ntry: _badger_entries=os.listdir('/apps')\nexcept OSError: _badger_entries=[]\nfor _badger_name in _badger_entries:\n if _badger_name not in ('menu','startup') and _badger_name not in _badger_disabled:\n  _badger_path='/apps/'+_badger_name\n  if is_dir(_badger_path) and file_exists(_badger_path+'/__init__.py'): _badger_writable.append((_badger_name,_badger_path))\n_badger_names=[_item[0] for _item in _badger_writable]\napps=[_item for _item in apps if _item[0] not in _badger_disabled and _item[0] not in _badger_names]\napps.extend(_badger_writable)\ndef _badger_app_path(_item):\n return _item[1] if _item[1].startswith('/') else '/system/apps/'+_item[1]\n_badger_icons_base=load_page_icons\ndef _badger_icons(_page):\n _icons=_badger_icons_base(_page);_start=_page*APPS_PER_PAGE;_end=min(_start+APPS_PER_PAGE,len(apps))\n for _index in range(_start,_end):\n  _item=apps[_index];_path=_badger_app_path(_item)\n  if _path.startswith('/apps/'):\n   _slot=_index-_start;_icon_path=_path+'/icon.png'\n   if file_exists(_icon_path): _icons.append(Icon((_slot%3*48+33,math.floor(_slot/3)*48+42),_item[0],_slot%APPS_PER_PAGE,Image.load(_icon_path)))\n return _icons\n_badger_update_base=update\ndef _badger_update():\n if io.BUTTON_B in io.pressed:\n  _index=current_page*APPS_PER_PAGE+active\n  if _index<len(apps):\n   _path=_badger_app_path(apps[_index])\n   if _path.startswith('/apps/') and is_dir(_path) and file_exists(_path+'/__init__.py'): return _path\n return _badger_update_base()\nload_page_icons=_badger_icons\nupdate=_badger_update\ntotal_pages=max(1,math.ceil(len(apps)/APPS_PER_PAGE))\ncurrent_page=0\nicons=load_page_icons(0)\nprint('${launcherBootMarker}')${launcherEnd}`
      let committed = false
      try {
        await rawExec("import os\ntry: os.mkdir('/apps')\nexcept OSError: pass\ntry: os.mkdir('/apps/menu')\nexcept OSError: pass\nsource='/apps/menu/__init__.py'\ntry: os.stat(source)\nexcept OSError: source='/system/apps/menu/__init__.py'\ns=open(source,'rb');d=open('/.badger-menu-upload.py','wb')\nwhile True:\n b=s.read(512)\n if not b: break\n d.write(b)\ns.close();d.close()\ntry: os.stat('/apps/menu/__init__.py.badger-backup')\nexcept OSError:\n s=open(source,'rb');d=open('/apps/menu/__init__.py.badger-backup','wb')\n while True:\n  b=s.read(512)\n  if not b: break\n  d.write(b)\n s.close();d.close()")
        await appendSerialText('/.badger-menu-upload.py', injection)
        const validation = await rawExec("f=open('/.badger-menu-upload.py','r');s=f.read();f.close();compile(s,'/apps/menu/__init__.py','exec');print('__BADGER_MENU_VALID__')")
        if (!validation.includes('__BADGER_MENU_VALID__')) throw new Error('The writable launcher update did not pass validation.')
        const appValidation = await rawExec("import os,gc\nfrom badgeware import is_dir,file_exists,Image\nfor n in os.listdir('/apps'):\n if n not in ('.disabled','menu','startup'):\n  p='/apps/'+n\n  if is_dir(p) and file_exists(p+'/__init__.py'):\n   if not file_exists(p+'/icon.png'): raise OSError('missing icon: '+n)\n   x=Image.load(p+'/icon.png');del x;gc.collect()\nprint('__BADGER_APPS_VALID__')")
        if (!appValidation.includes('__BADGER_APPS_VALID__')) throw new Error('The uploaded apps did not pass launcher validation.')
        const commit = await rawExec("import os\ntry: os.remove('/apps/menu/__init__.py')\nexcept OSError: pass\nos.rename('/.badger-menu-upload.py','/apps/menu/__init__.py')\ntry: os.sync()\nexcept Exception: pass\nprint('__BADGER_MENU_OK__')")
        if (!commit.includes('__BADGER_MENU_OK__')) throw new Error('The writable launcher update could not be committed.')
        committed = true
        const installed = await rawExec(`import os\ns=os.stat('/apps/menu/__init__.py')[6];f=open('/apps/menu/__init__.py','rb');f.seek(max(0,s-256));t=f.read();f.close();print('__BADGER_MENU_INSTALLED__'+('1' if ${JSON.stringify(launcherEnd.trim())} in t.decode() else '0'))`)
        if (!installed.includes('__BADGER_MENU_INSTALLED__1')) throw new Error('The writable launcher update did not verify after installation.')
        const runtime = await rawExec("import os,sys\nos.chdir('/')\nfor n in ('ui','icon'):\n try: del sys.modules[n]\n except KeyError: pass\nm=__import__('/apps/menu')\nprint('__BADGER_MENU_RUNTIME__'+('1' if hasattr(m,'_BADGER_WEB_MENU_V4') else '0'))", 12000)
        if (!runtime.includes('__BADGER_MENU_RUNTIME__1')) throw new Error('The writable launcher did not load correctly.')
      } catch (error) {
        if (committed) {
          await restoreWritableLauncher().catch(() => undefined)
          await restartSerialBadge().catch(() => undefined)
          throw new Error('The launcher update failed verification, so the previous launcher was restored.')
        }
        throw error
      }
    }
    let main = await readSerialText('/main.py')
    if (main === null) main = await readSerialText('/system/main.py')
    if (main === null) throw new Error('The badge launcher could not be read.')
    if (main.includes('__import__("/apps/menu")')) return
    const redirectedMain = main.replace('__import__("/system/apps/menu")', '__import__("/apps/menu")')
    if (redirectedMain === main) throw new Error('This badge has an unsupported main.py launcher.')
    await writeSerialText('/main.py.badger-backup', main)
    await writeSerialText('/.badger-main-upload.py', redirectedMain)
    const validation = await rawExec("f=open('/.badger-main-upload.py','r');s=f.read();f.close();compile(s,'/main.py','exec');print('__BADGER_MAIN_VALID__')")
    if (!validation.includes('__BADGER_MAIN_VALID__')) throw new Error('The launcher redirect did not pass validation.')
    const commit = await rawExec("import os\ntry: os.remove('/main.py')\nexcept OSError: pass\nos.rename('/.badger-main-upload.py','/main.py')\ntry: os.sync()\nexcept Exception: pass\nprint('__BADGER_MAIN_OK__')")
    if (!commit.includes('__BADGER_MAIN_OK__')) throw new Error('The launcher redirect could not be committed.')
    const installedMain = await readSerialText('/main.py')
    if (installedMain !== redirectedMain) {
      await restoreMainLauncher().catch(() => undefined)
      throw new Error('The launcher redirect failed verification, so the previous launcher was restored.')
    }
  }

  async function restoreWritableLauncher() {
    const response = await rawExec("import os\ns=open('/apps/menu/__init__.py.badger-backup','rb');d=open('/.badger-menu-restore.py','wb')\nwhile True:\n b=s.read(512)\n if not b: break\n d.write(b)\ns.close();d.close()\ntry: os.remove('/apps/menu/__init__.py')\nexcept OSError: pass\nos.rename('/.badger-menu-restore.py','/apps/menu/__init__.py')\ntry: os.sync()\nexcept Exception: pass\nprint('__BADGER_MENU_RESTORED__')")
    if (!response.includes('__BADGER_MENU_RESTORED__')) throw new Error('The previous badge launcher could not be restored.')
  }

  async function restoreMainLauncher() {
    const response = await rawExec("import os\ns=open('/main.py.badger-backup','rb');d=open('/.badger-main-restore.py','wb')\nwhile True:\n b=s.read(512)\n if not b: break\n d.write(b)\ns.close();d.close()\ntry: os.remove('/main.py')\nexcept OSError: pass\nos.rename('/.badger-main-restore.py','/main.py')\ntry: os.sync()\nexcept Exception: pass\nprint('__BADGER_MAIN_RESTORED__')")
    if (!response.includes('__BADGER_MAIN_RESTORED__')) throw new Error('The previous main.py could not be restored.')
  }

  async function setFirmwareAppDisabled(name: string, disabled: boolean) {
    await rawExec(`import os\ntry: os.mkdir('/apps')\nexcept OSError: pass\ntry:\n f=open('/apps/.disabled','r');xs=[x.strip() for x in f.readlines() if x.strip()];f.close()\nexcept OSError: xs=[]\nn=${JSON.stringify(name)}\nif ${disabled ? 'True' : 'False'}:\n if n not in xs: xs.append(n)\nelse:\n xs=[x for x in xs if x!=n]\nf=open('/apps/.disabled','w')\nfor x in xs: f.write(x+'\\n')\nf.close()\ntry: os.sync()\nexcept Exception: pass`)
  }

  async function restartSerialBadge() {
    serialResponseRef.current = ''
    try {
      await write('\r\u0003\u0003\u0004')
      await new Promise((resolve) => window.setTimeout(resolve, 350))
      await write('\u0002\u0004')
    } finally {
      serialInterruptedRef.current = false
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1000))
  }

  async function run(task: () => Promise<void>, setLocalResult?: (result: OperationResult) => void) {
    setBusy(true)
    setResult(null)
    try {
      await task()
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The badge operation failed.'
      const operationResult: OperationResult = { tone: 'error', message }
      setResult(operationResult)
      setLocalResult?.(operationResult)
      return false
    } finally {
      if (serialInterruptedRef.current && portRef.current) await restartSerialBadge().catch(() => undefined)
      setBusy(false)
    }
  }

  async function connect() {
    await run(async () => {
      if (!SERIAL_CONNECTION_MODE_ENABLED) throw new Error('Serial mode is temporarily unavailable.')
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
      await readSerialBadge()
      await restartSerialBadge()
      setStatus('Connected. The installed app list is up to date.')
      setResult(null)
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
      await readDiskBadge(root)
    })
  }

  async function disconnect() {
    await releaseSerial('Disconnected. The badge was restarted.')
  }

  async function readSerialBadge() {
    const appPayload = await rawExec(`import os\ndisabled=[]\ntry:\n f=open('/apps/.disabled','r');disabled=[x.strip() for x in f.readlines() if x.strip()];f.close()\nexcept OSError: pass\nfor root,kind in (('/system/apps','I'),('/apps','U')):\n try: entries=os.listdir(root)\n except OSError: entries=[]\n for n in entries:\n  if isinstance(n,str) and n!='menu' and not (kind=='I' and n in disabled):\n   try:\n    os.stat(root+'/'+n+'/__init__.py')\n    print('__BADGER_APP__'+kind+':'+n)\n   except OSError: pass\ntry:\n s=os.stat('/apps/menu/__init__.py')[6];f=open('/apps/menu/__init__.py','rb');f.seek(max(0,s-256));t=f.read();f.close();f=open('/main.py','r');m=f.read();f.close();print('__BADGER_LAUNCHER__'+('1' if ${JSON.stringify(launcherEnd.trim())} in t.decode() and '__import__("/apps/menu")' in m else '0'))\nexcept OSError: print('__BADGER_LAUNCHER__0')`)
    const found = new Map<string, DeviceApp>()
    const writable = new Set<string>()
    let launcherReady = false
    for (const line of appPayload.split(/\r?\n/).map((name) => name.trim()).filter(Boolean)) {
      if (line === '__BADGER_LAUNCHER__1') launcherReady = true
      if (!line.startsWith('__BADGER_APP__')) continue
      const payload = line.slice('__BADGER_APP__'.length)
      const kind = payload.slice(0, 1)
      const name = payload.slice(2)
      if (!name || name === 'menu' || name === 'startup') continue
      if (kind === 'I') found.set(name, { name, size: 0, firmware: true })
      if (kind === 'U') writable.add(name)
    }
    if (launcherReady) {
      for (const name of writable) found.set(name, { name, size: 0, firmware: false })
    }
    const discoveredApps = [...found.values()].sort((left, right) => left.name.localeCompare(right.name))
    setApps(discoveredApps)
    setLegacyApps(launcherReady ? [] : [...writable].sort((left, right) => left.localeCompare(right)))
  }

  async function readDiskBadge(root: DiskDirectoryHandle) {
    const appsRoot = await root.getDirectoryHandle('apps')
    const found: DeviceApp[] = []
    for await (const entry of appsRoot.values()) {
      if (entry.kind !== 'directory' || entry.name === 'menu' || entry.name === 'startup') continue
      try {
        const appRoot = await appsRoot.getDirectoryHandle(entry.name)
        await appRoot.getFileHandle('__init__.py')
        let size = 0
        for await (const file of appRoot.values()) {
          if (file.kind === 'file' && file.getFile) size += (await file.getFile()).size
        }
        found.push({ name: entry.name, size, firmware: true })
      } catch {
        continue
      }
    }
    setApps(found.sort((left, right) => left.name.localeCompare(right.name)))
    setLegacyApps([])
    setStatus(`BADGER disk ${root.name} is connected. The installed app list is up to date.`)
  }

  function stageFiles(files: AppFile[]) {
    setSaveResult(null)
    const additions = makePendingApps(files)
    const occupied = new Set([...apps.map((app) => app.name), ...legacyApps])
    const duplicates = additions.filter((app) => occupied.has(app.name)).map((app) => app.name)
    const incomplete = additions.filter((app) => !app.files.some((entry) => relativeInstallPath(entry) === '__init__.py')).map((app) => app.name)
    const accepted = additions.filter((app) => !occupied.has(app.name) && !incomplete.includes(app.name))
    setPendingApps((current) => {
      const next = new Map(current.map((item) => [item.name, item]))
      for (const app of accepted) next.set(app.name, app)
      return [...next.values()]
    })
    if (duplicates.length) {
      const message = `${duplicates.join(', ')} ${duplicates.length === 1 ? 'is' : 'are'} already on the badge and cannot be uploaded again.`
      setResult({ tone: 'error', message })
      return
    }
    if (incomplete.length) {
      const message = `${incomplete.join(', ')} ${incomplete.length === 1 ? 'is' : 'are'} missing __init__.py.`
      setResult({ tone: 'error', message })
      return
    }
    setResult(null)
    setStatus(connected
      ? `${accepted.length} app${accepted.length === 1 ? '' : 's'} ready to save.`
      : `${accepted.length} app${accepted.length === 1 ? '' : 's'} selected. ${SERIAL_CONNECTION_MODE_ENABLED ? 'Connect your badge over serial' : 'Open the BADGER disk'} before saving.`)
  }

  function addFiles(files: FileList | File[]) {
    stageFiles(normalizeFiles(files))
  }

  async function addStoreApp(app: StoreApp) {
    setSaveResult(null)
    if (apps.some((installed) => installed.name === app.name) || legacyApps.includes(app.name)) {
      throw new Error(`${app.title} is already on this badge.`)
    }
    setStatus(`Getting ${app.title} from badger/home…`)
    const files = await Promise.all(app.files.map(async (path) => {
      const response = await fetch(appFileUrl(app.revision, app.name, path))
      if (!response.ok) throw new Error(`Could not get ${app.title} from the app store.`)
      const contents = await response.blob()
      return { file: new File([contents], path.split('/').at(-1) ?? path), relativePath: `${app.name}/${path}` }
    }))
    setPendingApps((current) => [...current.filter((item) => item.name !== app.name), { name: app.name, files, source: 'store' }])
    setStatus(connected
      ? `${app.title} is ready to save.`
      : `${app.title} is selected. ${SERIAL_CONNECTION_MODE_ENABLED ? 'Connect your badge over serial' : 'Open the BADGER disk'} before saving.`)
  }

  function toggleStoreApp(app: StoreApp) {
    setSaveResult(null)
    const installed = apps.some((item) => item.name === app.name)
    if (installed) {
      setRemoveQueue((current) => current.includes(app.name)
        ? current.filter((name) => name !== app.name)
        : [...current, app.name])
      return
    }
    if (pendingApps.some((item) => item.name === app.name)) {
      setPendingApps((current) => current.filter((item) => item.name !== app.name))
      return
    }
    void run(() => addStoreApp(app), setSaveResult)
  }

  function clearSelections() {
    setPendingApps([])
    setRemoveQueue([])
    setResult(null)
    setSaveResult(null)
    setStatus(connected
      ? 'Selection cleared. No changes are queued.'
      : `Selection cleared. ${SERIAL_CONNECTION_MODE_ENABLED ? 'Connect a badge running MicroPython.' : 'Open the BADGER disk to add apps to your badge.'}`)
  }

  async function installApps() {
    setSaveResult(null)
    return run(async () => {
      if (!pendingApps.length) return
      const occupied = new Set([...apps.map((app) => app.name), ...legacyApps])
      const conflicts = pendingApps.filter((app) => occupied.has(app.name)).map((app) => app.name)
      if (conflicts.length) throw new Error(`${conflicts.join(', ')} ${conflicts.length === 1 ? 'is' : 'are'} already on the badge. Remove the existing app before uploading another copy.`)
      const appCount = pendingApps.length
      setStatus('Preparing app upload…')
      if (diskRoot) {
        const appsRoot = await diskRoot.getDirectoryHandle('apps', { create: true })
        for (const app of pendingApps) {
          await appsRoot.removeEntry(app.name, { recursive: true }).catch(() => undefined)
          const appRoot = await appsRoot.getDirectoryHandle(app.name, { create: true })
          for (const [index, entry] of app.files.entries()) {
            setStatus(`Uploading ${app.name} · ${index + 1} of ${app.files.length}`)
            const relativePath = relativeInstallPath(entry)
            const parts = relativePath.split('/').filter(Boolean)
            const fileName = parts.pop()
            if (!fileName) continue
            let directory = appRoot
            for (const part of parts) directory = await directory.getDirectoryHandle(part, { create: true })
            const fileHandle = await directory.getFileHandle(fileName, { create: true })
            const writable = await fileHandle.createWritable()
            await writable.write(await entry.file.arrayBuffer())
            await writable.close()
            if ((await fileHandle.getFile()).size !== entry.file.size) throw new Error(`${app.name}/${relativePath} did not verify after upload.`)
          }
        }
        setPendingApps([])
        await readDiskBadge(diskRoot)
        const message = `${appCount} app${appCount === 1 ? '' : 's'} installed and verified. Eject BADGER on your machine, then restart it to refresh the launcher.`
        setStatus(message)
        const operationResult: OperationResult = { tone: 'success', message }
        setResult(operationResult)
        setSaveResult(operationResult)
        return
      }
      await rawExec("import os\ntry: os.mkdir('/apps')\nexcept OSError: pass")
      for (const app of pendingApps) {
        const appRoot = `${serialAppsRoot}/${app.name}`
        const uploadRoot = `/.badger-upload-${app.name}`
        await rawExec(`${remoteRemoveCode(uploadRoot)}\n${remoteRemoveCode(appRoot)}\nos.mkdir(${JSON.stringify(uploadRoot)})`)
        for (const [index, entry] of app.files.entries()) {
          setStatus(`Uploading ${app.name} · ${index + 1} of ${app.files.length}`)
          const relativePath = relativeInstallPath(entry)
          const parts = relativePath.split('/').filter(Boolean)
          const fileName = parts.pop()
          if (!fileName) continue
          let directory = uploadRoot
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
          const verification = await rawExec(`import os\nprint('__BADGER_SIZE__'+str(os.stat(${JSON.stringify(destination)})[6]))`)
          const verifiedSize = verification.split(/\r?\n/).find((line) => line.startsWith('__BADGER_SIZE__'))?.slice('__BADGER_SIZE__'.length)
          if (verifiedSize !== String(bytes.length)) throw new Error(`${app.name}/${relativePath} did not verify after upload.`)
        }
        const commit = await rawExec(`import os\nos.rename(${JSON.stringify(uploadRoot)},${JSON.stringify(appRoot)})\nos.stat(${JSON.stringify(`${appRoot}/__init__.py`)})\nprint('__BADGER_INSTALL_OK__')`)
        if (!commit.includes('__BADGER_INSTALL_OK__')) throw new Error(`${app.name} could not be installed.`)
        await setFirmwareAppDisabled(app.name, false)
      }
      await ensureWritableLauncher()
      setPendingApps([])
      setApps((current) => {
        const installed = new Map(current.map((app) => [app.name, app]))
        for (const app of pendingApps) installed.set(app.name, { name: app.name, size: app.files.reduce((total, entry) => total + entry.file.size, 0), firmware: false })
        return [...installed.values()].sort((left, right) => left.name.localeCompare(right.name))
      })
      await restartSerialBadge()
      const message = `${appCount} app${appCount === 1 ? '' : 's'} installed and verified. The badge restarted with the updated launcher.`
      setStatus(message)
      const operationResult: OperationResult = { tone: 'success', message }
      setResult(operationResult)
      setSaveResult(operationResult)
    }, setSaveResult)
  }

  async function removeApps() {
    setSaveResult(null)
    return run(async () => {
      if (!removeQueue.length) return
      if (diskRoot) {
        const appsRoot = await diskRoot.getDirectoryHandle('apps')
        for (const name of removeQueue) await appsRoot.removeEntry(name, { recursive: true })
        const removedCount = removeQueue.length
        setRemoveQueue([])
        await readDiskBadge(diskRoot)
        const message = `${removedCount} app${removedCount === 1 ? '' : 's'} removed and verified. Eject BADGER on your machine, then restart it to refresh the launcher.`
        setStatus(message)
        const operationResult: OperationResult = { tone: 'success', message }
        setResult(operationResult)
        setSaveResult(operationResult)
        return
      }
      const removed = [...removeQueue]
      for (const name of removeQueue) {
        const target = `${serialAppsRoot}/${name}`
        const response = await rawExec(`import os\n${remoteRemoveCode(target)}\ntry: os.stat(${JSON.stringify(target)});print('__BADGER_REMOVE_FAILED__')\nexcept OSError: print('__BADGER_REMOVE_OK__')`)
        if (!response.includes('__BADGER_REMOVE_OK__')) throw new Error(`Could not remove ${name}. Restart the badge and try again.`)
        await setFirmwareAppDisabled(name, true)
      }
      await ensureWritableLauncher()
      setRemoveQueue([])
      setApps((current) => current.filter((app) => !removed.includes(app.name)))
      await restartSerialBadge()
      const message = `${removed.length} app${removed.length === 1 ? '' : 's'} removed and verified. The badge restarted with the updated launcher.`
      setStatus(message)
      const operationResult: OperationResult = { tone: 'success', message }
      setResult(operationResult)
      setSaveResult(operationResult)
    }, setSaveResult)
  }

  async function saveChanges() {
    setSaveResult(null)
    if (removeQueue.length) {
      const removed = await removeApps()
      if (!removed) return
    }
    if (pendingApps.length) await installApps()
  }

  async function recoverLegacyApps() {
    await run(async () => {
      if (!legacyApps.length || !portRef.current) return
      const recovered = [...legacyApps]
      const recoveredCount = legacyApps.length
      setStatus('Updating the writable badge launcher…')
      await ensureWritableLauncher()
      await restartSerialBadge()
      setApps((current) => {
        const installed = new Map(current.map((app) => [app.name, app]))
        for (const name of recovered) installed.set(name, { name, size: 0, firmware: false })
        return [...installed.values()].sort((left, right) => left.name.localeCompare(right.name))
      })
      setLegacyApps([])
      const message = `${recoveredCount} old upload${recoveredCount === 1 ? '' : 's'} added to the launcher. The badge restarted. Press any badge button after the intro appears.`
      setStatus(message)
      setResult({ tone: 'success', message })
    })
  }

  const displayedStatus = result?.tone === 'error'
    ? diskRoot
      ? 'BADGER disk connected.'
      : connected
        ? 'Badge connected over serial.'
        : 'No badge connected.'
    : status
  const localPendingApps = pendingApps.filter((app) => app.source === 'local')
  const hasPendingChanges = pendingApps.length > 0 || removeQueue.length > 0

  return (
    <div className="badge-edit-root w-full space-y-6">
      <section id="connect-badge" className="scroll-mt-28 rounded-lg border border-primary/20 bg-card/80 p-5 sm:p-6">
        <h2 className="text-2xl sm:text-3xl">Connect your badge</h2>
        <div className="mt-5 flex flex-col gap-3 rounded-lg bg-background/70 px-4 py-3 sm:flex-row sm:items-center">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${connected ? 'bg-primary shadow-[0_0_12px_rgba(95,237,131,0.9)]' : 'bg-muted-foreground'}`} />
          <span className="flex min-h-6 min-w-0 flex-1 items-center font-mono text-sm">{displayedStatus}</span>
          {connected && <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-mono text-xs text-primary">{diskRoot ? 'Disk mode' : 'Serial mode'}</span>}
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            {connected
              ? diskRoot
                ? <Button onClick={() => ejectDisk()} variant="outline"><LogOut /> Eject</Button>
                : <Button onClick={disconnect} variant="outline">Disconnect</Button>
              : <>{SERIAL_CONNECTION_MODE_ENABLED && <Button onClick={connect} disabled={busy}><PlugZap /> Connect serial</Button>}<Button onClick={connectDisk} variant="outline" disabled={busy}><FolderUp /> Open BADGER disk</Button></>}
          </div>
        </div>
        <div className="mt-4"><BadgeSetupGuide /></div>
        {result && <div role={result.tone === 'error' ? 'alert' : 'status'} className={`mt-3 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${result.tone === 'success' ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-red-400/30 bg-red-400/10 text-red-700 dark:text-red-100'}`}>{result.tone === 'success' ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <CircleAlert className="h-4 w-4 shrink-0" />}<span className="min-w-0 flex-1">{result.message}</span><button type="button" onClick={() => setResult(null)} className="rounded p-1 opacity-70 transition hover:opacity-100" aria-label="Dismiss message"><X className="h-4 w-4" /></button></div>}
      </section>

      <section id="available-apps" className="scroll-mt-28 rounded-lg border border-border/50 bg-card/80 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl">Available apps</h2>
            <p role="status" className="mt-2 text-sm text-muted-foreground">{storeMessage}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="uppercase tracking-[0.12em]" size="sm" variant="outline" onClick={() => void loadStore(true)} disabled={busy || storeLoading} aria-busy={storeLoading}><RefreshCw className={storeLoading ? 'animate-spin' : undefined} /> {storeLoading ? 'Reloading' : 'Reload'}</Button>
            <Button className={`uppercase tracking-[0.12em] ${hasPendingChanges ? 'badge-edit-primary disabled:!opacity-100' : ''}`} size="sm" variant={hasPendingChanges ? 'default' : 'outline'} onClick={() => void saveChanges()} disabled={busy || !connected || !hasPendingChanges}><Save /> Save</Button>
            <Button className="uppercase tracking-[0.12em]" size="sm" variant="outline" onClick={clearSelections} disabled={busy || !hasPendingChanges}><X /> Clear selection</Button>
          </div>
        </div>
        {legacyApps.length > 0 && !diskRoot && <div className="mt-5 rounded-lg border border-amber-300/30 bg-amber-300/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-3"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" /><div><p className="text-sm font-medium">Old uploads need repair</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{legacyApps.join(', ')} {legacyApps.length === 1 ? 'is' : 'are'} on the badge but not indexed by its launcher.</p></div></div><Button size="sm" variant="outline" onClick={recoverLegacyApps} disabled={busy}>Update launcher</Button></div></div>}
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {storeApps.map((app) => {
            const queued = pendingApps.some((item) => item.name === app.name)
            const installed = apps.some((item) => item.name === app.name)
            const removalQueued = removeQueue.includes(app.name)
            const needsRepair = legacyApps.includes(app.name)
            return <StoreAppCard
              key={app.name}
              title={app.title}
              iconUrl={app.iconUrl}
              iconColor={app.iconColor}
              description={app.description}
              queued={queued}
              installed={installed}
              removalQueued={removalQueued}
              needsRepair={needsRepair}
              busy={busy}
              onToggle={() => toggleStoreApp(app)}
            />
          })}
        </div>
        {saveResult && <div role={saveResult.tone === 'error' ? 'alert' : 'status'} className={`mt-5 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${saveResult.tone === 'success' ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-red-400/30 bg-red-400/10 text-red-700 dark:text-red-100'}`}>{saveResult.tone === 'success' ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <CircleAlert className="h-4 w-4 shrink-0" />}<span className="min-w-0 flex-1">{saveResult.message}</span><button type="button" onClick={() => setSaveResult(null)} className="rounded p-1 opacity-70 transition hover:opacity-100" aria-label="Dismiss save message"><X className="h-4 w-4" /></button></div>}
      </section>

      <section id="add-local-app" className="scroll-mt-28 rounded-lg border border-border/50 bg-card/80 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl">Add local app</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Review apps selected above or choose an app folder from your computer.</p>
          </div>
          {localPendingApps.length > 0 && <button type="button" onClick={() => pickerRef.current?.click()} className="badge-edit-ghost inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"><FolderUp className="h-3.5 w-3.5" />Add folder</button>}
        </div>
        <input ref={pickerRef} type="file" className="hidden" multiple webkitdirectory="" onChange={(event) => event.target.files && addFiles(event.target.files)} />
        {localPendingApps.length === 0 ? <button type="button" data-dragging={dragging} onClick={() => pickerRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void collectDroppedFiles(event.dataTransfer).then(stageFiles) }} className="badge-edit-dropzone mt-5 flex w-full items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 px-5 py-8 text-center transition-colors hover:border-primary/60">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/5"><FolderUp className="h-5 w-5 text-primary" /></span>
          <span className="text-left"><span className="block text-sm text-foreground">Choose an app folder</span><span className="mt-0.5 block text-xs text-muted-foreground">or drop it here</span></span>
        </button> : <>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {localPendingApps.map((app) => <div key={app.name} className="flex min-w-0 items-center gap-3 rounded-lg border border-border/50 bg-background/35 p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10"><FileCode2 className="h-5 w-5 text-primary" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate font-mono text-sm uppercase tracking-[0.1em] text-foreground">{app.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{app.files.length} file{app.files.length === 1 ? '' : 's'}</span></span>
              <button type="button" onClick={() => setPendingApps((current) => current.filter((item) => item.name !== app.name))} className="badge-edit-ghost grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground" aria-label={`Remove ${app.name}`} title={`Remove ${app.name}`}><X className="h-4 w-4" /></button>
            </div>)}
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">{connected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <PlugZap className="h-4 w-4 shrink-0 text-primary" />}{connected ? 'Ready. Select Save in Available apps to apply changes.' : 'Connect a badge before saving changes.'}</p>
          </div>
        </>}
      </section>

      {connected && port && <details className="rounded-xl border border-border/50 bg-card/65 px-5 py-4"><summary className="cursor-pointer font-mono text-sm">Serial console</summary><pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-[hsl(var(--inset))] p-4 font-mono text-xs text-muted-foreground">{output || 'Waiting for serial output.'}</pre></details>}
      {busy && <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 backdrop-blur-sm"><div className="flex max-w-md items-center gap-3 rounded-xl border border-primary/30 bg-card px-5 py-4 font-mono text-sm shadow-xl"><LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-primary" /> {status}</div></div>}
    </div>
  )
}
