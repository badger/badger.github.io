import { useCallback, useEffect, useRef, useState } from 'react'
import { Bluetooth, Check, CircleAlert, Database, Eye, EyeOff, FlaskConical, PlugZap, Save, Trash2 } from 'lucide-react'
import {
  decodeFrames,
  notificationBytes,
  writeFrame,
  type BluetoothCharacteristic,
  type BluetoothDevice,
  type FramedMessage,
} from '@/lib/badge-bluetooth'

const serviceUuid = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
const receiveUuid = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
const transmitUuid = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'

type EditorInfo = {
  name: string
  version: number
  applied: number
  user: string
}

type TransferLog = {
  id: number
  time: number
  direction: 'tx' | 'rx'
  kind: string
  bytes: number
  detail: string
}

type Totals = {
  txMessages: number
  rxMessages: number
  txBytes: number
  rxBytes: number
  chunks: number
}

type TestResult = {
  ok: boolean
  ms?: number
  sent?: number
  received?: number
  error?: string
}

const emptyTotals: Totals = { txMessages: 0, rxMessages: 0, txBytes: 0, rxBytes: 0, chunks: 0 }

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === 'number' ? value : fallback
}

function summary(message: FramedMessage) {
  if (message.cmd === 'push' || message.type === 'secrets') return `${stringValue(message.content).length} characters of secrets.py`
  if (message.type === 'info') return `${stringValue(message.name, 'badge')} · v${numberValue(message.version)} · ${stringValue(message.user, 'unknown user')}`
  if (message.type === 'applied') return `saved v${numberValue(message.version)}`
  if (message.cmd === 'test' || message.type === 'test') return `nonce ${stringValue(message.nonce)}`
  return JSON.stringify(message).slice(0, 100)
}

function formatBytes(value: number) {
  return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`
}

function formatTime(value: number) {
  const date = new Date(value)
  return `${date.toLocaleTimeString([], { hour12: false })}.${String(date.getMilliseconds()).padStart(3, '0')}`
}

export function BluetoothEditor() {
  const [view, setView] = useState<'editor' | 'data'>('editor')
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [deviceName, setDeviceName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState<EditorInfo | null>(null)
  const [content, setContent] = useState('')
  const [contentVisible, setContentVisible] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [appliedVersion, setAppliedVersion] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [log, setLog] = useState<TransferLog[]>([])
  const [totals, setTotals] = useState<Totals>(emptyTotals)
  const deviceRef = useRef<BluetoothDevice | null>(null)
  const receiveRef = useRef<BluetoothCharacteristic | null>(null)
  const transmitRef = useRef<BluetoothCharacteristic | null>(null)
  const listenerRef = useRef<((event: Event) => void) | null>(null)
  const bufferRef = useRef(new Uint8Array())
  const loadedRef = useRef(false)
  const logIdRef = useRef(0)
  const pendingTestsRef = useRef(new Map<string, (message: FramedMessage) => void>())

  const supported = typeof navigator !== 'undefined' && Boolean(navigator.bluetooth)
  const connected = status === 'connected'

  const appendLog = useCallback((direction: 'tx' | 'rx', kind: string, bytes: number, detail: string) => {
    const entry = { id: ++logIdRef.current, time: Date.now(), direction, kind, bytes, detail }
    setLog((current) => [...current, entry].slice(-500))
    setTotals((current) => direction === 'tx'
      ? { ...current, txMessages: current.txMessages + 1, txBytes: current.txBytes + bytes }
      : { ...current, rxMessages: current.rxMessages + 1, rxBytes: current.rxBytes + bytes })
  }, [])

  const handleMessage = useCallback((message: FramedMessage, bytes: number) => {
    const type = stringValue(message.type, 'message')
    appendLog('rx', type, bytes, summary(message))
    if (type === 'info') {
      setInfo({
        name: stringValue(message.name, 'badge'),
        version: numberValue(message.version, 1),
        applied: numberValue(message.applied, 1),
        user: stringValue(message.user, 'unknown'),
      })
    } else if (type === 'secrets' && !loadedRef.current) {
      loadedRef.current = true
      setContent(stringValue(message.content))
      setDirty(false)
    } else if (type === 'applied') {
      const version = numberValue(message.version)
      setAppliedVersion(version)
      setPushing(false)
      setInfo((current) => current ? { ...current, version, applied: version, user: stringValue(message.user, current.user) } : current)
    } else if (type === 'test') {
      const nonce = stringValue(message.nonce)
      pendingTestsRef.current.get(nonce)?.(message)
      pendingTestsRef.current.delete(nonce)
    } else if (type === 'error') {
      setError(stringValue(message.detail, 'The badge rejected that request.'))
      setPushing(false)
    }
  }, [appendLog])

  const onNotification = useCallback((event: Event) => {
    try {
      const incoming = notificationBytes(event)
      setTotals((current) => ({ ...current, chunks: current.chunks + 1 }))
      const decoded = decodeFrames(bufferRef.current, incoming)
      bufferRef.current = decoded.rest
      for (const message of decoded.messages) {
        const bytes = new TextEncoder().encode(JSON.stringify(message)).length
        handleMessage(message, bytes)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Badge sent an unreadable response.')
      bufferRef.current = new Uint8Array()
    }
  }, [handleMessage])

  const send = useCallback(async (message: FramedMessage) => {
    if (!receiveRef.current) throw new Error('Connect to the Editor (BT) app first.')
    const result = await writeFrame(receiveRef.current, message)
    setTotals((current) => ({ ...current, chunks: current.chunks + result.chunks }))
    appendLog('tx', stringValue(message.cmd, 'message'), result.bytes, summary(message))
  }, [appendLog])

  const disconnectState = useCallback(() => {
    receiveRef.current = null
    transmitRef.current = null
    bufferRef.current = new Uint8Array()
    loadedRef.current = false
    pendingTestsRef.current.clear()
    setStatus('disconnected')
    setDeviceName('')
    setInfo(null)
    setContent('')
    setContentVisible(false)
    setDirty(false)
    setPushing(false)
    setTesting(false)
    setAppliedVersion(null)
    setTestResult(null)
  }, [])

  const disconnect = useCallback(() => {
    try {
      deviceRef.current?.gatt?.disconnect()
    } finally {
      disconnectState()
    }
  }, [disconnectState])

  useEffect(() => () => {
    if (transmitRef.current && listenerRef.current) transmitRef.current.removeEventListener('characteristicvaluechanged', listenerRef.current)
    deviceRef.current?.gatt?.disconnect()
  }, [])

  const connect = async () => {
    if (!window.isSecureContext) {
      setError('Web Bluetooth needs HTTPS or localhost.')
      return
    }
    if (!navigator.bluetooth) {
      setError('Web Bluetooth is unavailable here. Use Chrome or Edge on desktop or Android.')
      return
    }
    setStatus('connecting')
    setError('')
    setAppliedVersion(null)
    setTestResult(null)
    try {
      const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [serviceUuid] }], optionalServices: [serviceUuid] })
      if (!device.gatt) throw new Error('The selected badge has no Bluetooth GATT connection.')
      deviceRef.current = device
      device.addEventListener('gattserverdisconnected', disconnectState)
      const server = await device.gatt.connect()
      const service = await server.getPrimaryService(serviceUuid)
      const receive = await service.getCharacteristic(receiveUuid)
      const transmit = await service.getCharacteristic(transmitUuid)
      await transmit.startNotifications()
      transmit.addEventListener('characteristicvaluechanged', onNotification)
      receiveRef.current = receive
      transmitRef.current = transmit
      listenerRef.current = onNotification
      bufferRef.current = new Uint8Array()
      loadedRef.current = false
      setDeviceName(device.name || 'badge')
      setStatus('connected')
      await sendWith(receive, { cmd: 'hello' })
    } catch (reason) {
      setStatus('disconnected')
      if ((reason as { name?: string })?.name !== 'NotFoundError') setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const sendWith = async (characteristic: BluetoothCharacteristic, message: FramedMessage) => {
    const result = await writeFrame(characteristic, message)
    setTotals((current) => ({ ...current, chunks: current.chunks + result.chunks }))
    appendLog('tx', stringValue(message.cmd, 'message'), result.bytes, summary(message))
  }

  const save = useCallback(async () => {
    if (!connected) return
    setError('')
    setPushing(true)
    try {
      await send({ cmd: 'push', content, version: (info?.version ?? 1) + 1 })
      setDirty(false)
    } catch (reason) {
      setPushing(false)
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [connected, content, info?.version, send])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [save])

  const test = async () => {
    if (!connected) return
    setTesting(true)
    setTestResult(null)
    setError('')
    const nonce = Math.random().toString(36).slice(2, 10)
    const payload = `datasync-${nonce}-${'x'.repeat(64)}`
    const started = performance.now()
    try {
      const response = await new Promise<FramedMessage>((resolve, reject) => {
        pendingTestsRef.current.set(nonce, resolve)
        void send({ cmd: 'test', nonce, payload }).catch(reject)
        window.setTimeout(() => {
          if (!pendingTestsRef.current.has(nonce)) return
          pendingTestsRef.current.delete(nonce)
          reject(new Error('Timed out waiting for the badge.'))
        }, 5000)
      })
      const received = numberValue(response.bytes)
      setTestResult({ ok: Boolean(response.ok) && received === payload.length, ms: Math.round(performance.now() - started), sent: payload.length, received })
    } catch (reason) {
      setTestResult({ ok: false, error: reason instanceof Error ? reason.message : String(reason) })
    } finally {
      setTesting(false)
    }
  }

  const clearLog = () => {
    setLog([])
    setTotals(emptyTotals)
    logIdRef.current = 0
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="surface overflow-hidden border-primary/20">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl">Bluetooth editor</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">Open Editor (BT) on the badge, then connect.</p>
          </div>
          <button type="button" onClick={connected ? disconnect : connect} disabled={status === 'connecting'} className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/45 bg-primary/10 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary/15 disabled:opacity-50">
            <PlugZap className="h-4 w-4" />{connected ? 'Disconnect' : status === 'connecting' ? 'Pairing…' : 'Connect Bluetooth'}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 bg-background/45 px-6 py-3 font-mono text-xs sm:px-8">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-primary shadow-[0_0_12px_rgba(95,237,131,0.9)]' : 'bg-muted-foreground'}`} />
          <span className="text-foreground">{connected ? deviceName : status === 'connecting' ? 'Waiting for device chooser' : 'Not connected'}</span>
          {info && <span className="text-muted-foreground">v{info.version} · {info.applied < info.version ? 'delivery pending' : 'in sync'} · user {info.user}</span>}
        </div>
      </section>

      {!supported && <div className="flex gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-100"><CircleAlert className="h-5 w-5 shrink-0" /><p>Web Bluetooth is unavailable here. Use Chrome or Edge on desktop or Android over HTTPS or localhost.</p></div>}
      {error && <div className="flex gap-3 rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-200"><CircleAlert className="h-5 w-5 shrink-0" /><p>{error}</p></div>}
      {appliedVersion !== null && <div className="flex gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-foreground"><Check className="h-5 w-5 shrink-0 text-primary" /><p>Saved as v{appliedVersion}. Press RESET on the back of the badge to load the new settings.</p></div>}
      {testResult && <div className={`flex gap-3 rounded-xl border p-4 text-sm ${testResult.ok ? 'border-primary/30 bg-primary/5 text-foreground' : 'border-red-400/30 bg-red-400/5 text-red-200'}`}><FlaskConical className="h-5 w-5 shrink-0" /><p>{testResult.ok ? `Datasync passed in ${testResult.ms} ms. Sent ${testResult.sent} bytes and received ${testResult.received}.` : testResult.error || 'Datasync test failed.'}</p></div>}

      {connected && <div className="flex gap-1 rounded-lg border border-border/60 bg-card/70 p-1">
        <button type="button" onClick={() => setView('editor')} className={`flex-1 rounded-md px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors ${view === 'editor' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Editor</button>
        <button type="button" onClick={() => setView('data')} className={`flex-1 rounded-md px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors ${view === 'data' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Transfer data</button>
      </div>}

      {connected && (view === 'editor' ? (
        <section className="surface p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl">secrets.py {dirty && <span className="font-mono text-xs font-normal uppercase tracking-[0.1em] text-amber-300">unsaved</span>}</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setContentVisible((current) => !current)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 font-mono text-xs text-foreground transition-colors hover:border-primary/60" aria-label={contentVisible ? 'Hide secrets' : 'Show secrets'}>{contentVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{contentVisible ? 'Hide' : 'Show'}</button>
              <button type="button" onClick={() => void test()} disabled={!connected || testing} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 font-mono text-xs text-foreground transition-colors hover:border-primary/60 disabled:opacity-40"><FlaskConical className="h-4 w-4" />{testing ? 'Testing…' : 'Test datasync'}</button>
              <button type="button" onClick={() => void save()} disabled={!connected || pushing} className="inline-flex items-center gap-2 rounded-lg border border-primary/45 bg-primary/10 px-3 py-2 font-mono text-xs text-primary transition-colors hover:bg-primary/15 disabled:opacity-40"><Save className="h-4 w-4" />{pushing ? 'Pushing…' : 'Save and push'}</button>
            </div>
          </div>
          <textarea value={contentVisible ? content : content.replace(/[^\r\n]/g, '•')} onChange={(event) => { setContent(event.target.value); setDirty(true) }} readOnly={!contentVisible} spellCheck={false} autoCapitalize="off" autoCorrect="off" placeholder="Waiting for the badge…" className="mt-5 min-h-[420px] w-full resize-y rounded-xl border border-border/60 bg-black/30 p-4 font-mono text-sm leading-6 text-foreground outline-none transition focus:border-primary/70 focus:ring-1 focus:ring-primary/30" />
        </section>
      ) : (
        <section className="surface p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4"><h2 className="flex items-center gap-2 text-xl"><Database className="h-5 w-5 text-primary" />Transfer data</h2><button type="button" onClick={clearLog} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 font-mono text-xs text-muted-foreground hover:border-primary/60 hover:text-foreground"><Trash2 className="h-4 w-4" />Clear</button></div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Sent', formatBytes(totals.txBytes)], ['Received', formatBytes(totals.rxBytes)], ['Messages', String(totals.txMessages + totals.rxMessages)], ['Chunks', String(totals.chunks)]].map(([label, value]) => <div key={label} className="rounded-lg border border-border/60 bg-background/45 px-4 py-3"><p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className="mt-1 text-lg text-foreground">{value}</p></div>)}
          </div>
          {log.length ? <div className="mt-5 overflow-x-auto rounded-lg border border-border/60"><table className="w-full min-w-[640px] border-collapse text-left font-mono text-xs"><thead><tr className="border-b border-border/60 bg-background/60 text-muted-foreground"><th className="px-3 py-2 font-normal">Time</th><th className="px-3 py-2 font-normal">Dir</th><th className="px-3 py-2 font-normal">Kind</th><th className="px-3 py-2 font-normal">Bytes</th><th className="px-3 py-2 font-normal">Detail</th></tr></thead><tbody>{[...log].reverse().map((entry) => <tr key={entry.id} className="border-b border-border/40 last:border-0"><td className="px-3 py-2 text-muted-foreground">{formatTime(entry.time)}</td><td className={`px-3 py-2 ${entry.direction === 'tx' ? 'text-primary' : 'text-emerald-300'}`}>{entry.direction === 'tx' ? '→ badge' : '← badge'}</td><td className="px-3 py-2 text-foreground">{entry.kind}</td><td className="px-3 py-2 text-muted-foreground">{entry.bytes}</td><td className="px-3 py-2 text-muted-foreground">{entry.detail}</td></tr>)}</tbody></table></div> : <div className="mt-5 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No transfers yet.</div>}
        </section>
      ))}
    </div>
  )
}
