import { useEffect, useRef, useState } from 'react'
import { Bluetooth, Check, CircleAlert, Download, RefreshCw, Save, Trash2 } from 'lucide-react'
import {
  decodeFrames,
  notificationBytes,
  writeFrame,
  type BluetoothCharacteristic,
  type BluetoothDevice,
  type FramedMessage,
} from '@/lib/badge-bluetooth'

const serviceUuid = 'a4310e0d-4c66-4a25-9ef3-7d8a35c5c501'
const receiveUuid = 'a4310e0d-4c66-4a25-9ef3-7d8a35c5c502'
const transmitUuid = 'a4310e0d-4c66-4a25-9ef3-7d8a35c5c503'

type Profile = {
  name: string
  linkedin: string
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function objectValue(value: unknown) {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function validLinkedIn(value: string) {
  return /^https:\/\/(?:[a-z0-9-]+\.)?linkedin\.com\/(?:in|pub)\/[^/?#\s]+\/?$/i.test(value.trim())
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') quoted = false
      else field += character
    } else if (character === '"') quoted = true
    else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (character !== '\r') field += character
  }
  if (field || row.length) rows.push([...row, field])
  return rows.filter((cells) => cells.some((cell) => cell.trim()))
}

export function ContactsEditor() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [deviceName, setDeviceName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [profile, setProfile] = useState<Profile>({ name: '', linkedin: '' })
  const [csv, setCsv] = useState('')
  const [contactCount, setContactCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loadingContacts, setLoadingContacts] = useState(false)
  const deviceRef = useRef<BluetoothDevice | null>(null)
  const receiveRef = useRef<BluetoothCharacteristic | null>(null)
  const transmitRef = useRef<BluetoothCharacteristic | null>(null)
  const listenerRef = useRef<((event: Event) => void) | null>(null)
  const bufferRef = useRef(new Uint8Array())
  const pairingCodeRef = useRef('')

  const connected = status === 'connected'
  const supported = typeof navigator !== 'undefined' && Boolean(navigator.bluetooth)
  const contacts = parseCsv(csv).slice(1)

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('pass') || ''
    pairingCodeRef.current = value
    setPairingCode(value)
  }, [])

  const disconnectState = () => {
    receiveRef.current = null
    transmitRef.current = null
    bufferRef.current = new Uint8Array()
    setStatus('disconnected')
    setSaving(false)
    setLoadingContacts(false)
  }

  const disconnect = () => {
    try {
      deviceRef.current?.gatt?.disconnect()
    } finally {
      disconnectState()
    }
  }

  useEffect(() => () => {
    if (transmitRef.current && listenerRef.current) transmitRef.current.removeEventListener('characteristicvaluechanged', listenerRef.current)
    deviceRef.current?.gatt?.disconnect()
  }, [])

  const receiveMessage = (message: FramedMessage) => {
    const type = stringValue(message.type)
    if (type === 'config') {
      const config = objectValue(message.config)
      if (config) setProfile({ name: stringValue(config.name), linkedin: stringValue(config.linkedin) })
      if (typeof message.contacts === 'number') setContactCount(message.contacts)
    } else if (type === 'profile') {
      const receivedProfile = objectValue(message.profile)
      if (receivedProfile) setProfile({ name: stringValue(receivedProfile.name), linkedin: stringValue(receivedProfile.linkedin) })
    } else if (type === 'saved') {
      const savedProfile = objectValue(message.profile) || objectValue(message.config)
      if (savedProfile) setProfile({ name: stringValue(savedProfile.name), linkedin: stringValue(savedProfile.linkedin) })
      setSaving(false)
      setNotice('Contact card saved to durable badge storage.')
    } else if (type === 'contacts') {
      const value = stringValue(message.csv)
      setCsv(value)
      setContactCount(Math.max(0, parseCsv(value).length - 1))
      setLoadingContacts(false)
    } else if (type === 'unauthorized') {
      setError(stringValue(message.detail, 'Open this page from the private QR code shown by the Contacts app.'))
      setSaving(false)
      setLoadingContacts(false)
    } else if (type === 'error') {
      setError(stringValue(message.detail, 'The badge rejected that request.'))
      setSaving(false)
      setLoadingContacts(false)
    }
  }

  const onNotification = (event: Event) => {
    try {
      const decoded = decodeFrames(bufferRef.current, notificationBytes(event))
      bufferRef.current = decoded.rest
      for (const message of decoded.messages) receiveMessage(message)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Badge sent an unreadable response.')
      bufferRef.current = new Uint8Array()
    }
  }

  const sendWith = async (characteristic: BluetoothCharacteristic, message: FramedMessage) => {
    await writeFrame(characteristic, { ...message, pass: pairingCodeRef.current })
  }

  const send = async (message: FramedMessage) => {
    if (!receiveRef.current) throw new Error('Connect to the Contacts app first.')
    await sendWith(receiveRef.current, message)
  }

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
    setNotice('')
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
      setDeviceName(device.name || 'contacts badge')
      setStatus('connected')
      await sendWith(receive, { cmd: 'hello' })
      await sendWith(receive, { cmd: 'get_contacts' })
    } catch (reason) {
      setStatus('disconnected')
      if ((reason as { name?: string })?.name !== 'NotFoundError') setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!profile.name.trim() || !validLinkedIn(profile.linkedin)) {
      setError('Add a name and a full linkedin.com profile URL before saving.')
      return
    }
    setSaving(true)
    try {
      await send({ cmd: 'save_profile', profile: { name: profile.name.trim(), linkedin: profile.linkedin.trim() } })
    } catch (reason) {
      setSaving(false)
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const refresh = async () => {
    setError('')
    setLoadingContacts(true)
    try {
      await send({ cmd: 'get_contacts' })
    } catch (reason) {
      setLoadingContacts(false)
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const clearContacts = async () => {
    if (!window.confirm('Clear all exchanged contacts from this badge?')) return
    setError('')
    try {
      await send({ cmd: 'clear_contacts' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }

  const download = () => {
    if (!csv) return
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'badge-contacts.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const updateProfile = (key: keyof Profile, value: string) => setProfile((current) => ({ ...current, [key]: value }))

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="surface overflow-hidden border-primary/20">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl">Contacts editor</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">Open Contacts on the badge and show its setup QR.</p>
          </div>
          <button type="button" onClick={connected ? disconnect : connect} disabled={status === 'connecting'} className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/45 bg-primary/10 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"><Bluetooth className="h-4 w-4" />{connected ? 'Disconnect' : status === 'connecting' ? 'Pairing…' : 'Connect Bluetooth'}</button>
        </div>
        <div className="grid gap-3 border-t border-border/60 bg-background/45 px-6 py-4 sm:grid-cols-[1fr_auto] sm:items-end sm:px-8">
          <label className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">Badge pairing code<input value={pairingCode} onChange={(event) => { const value = event.target.value.trim(); setPairingCode(value); pairingCodeRef.current = value }} placeholder="From the badge QR" autoCapitalize="off" autoCorrect="off" className="mt-2 block w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary/70 sm:max-w-sm" /></label>
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground"><span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-primary shadow-[0_0_12px_rgba(95,237,131,0.9)]' : 'bg-muted-foreground'}`} />{connected ? deviceName : status === 'connecting' ? 'Waiting for chooser' : 'Not connected'}</div>
        </div>
      </section>

      {!supported && <div className="flex gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-100"><CircleAlert className="h-5 w-5 shrink-0" /><p>Web Bluetooth is unavailable here. Use Chrome or Edge on desktop or Android over HTTPS or localhost.</p></div>}
      {error && <div className="flex gap-3 rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-200"><CircleAlert className="h-5 w-5 shrink-0" /><p>{error}</p></div>}
      {notice && <div className="flex gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-foreground"><Check className="h-5 w-5 shrink-0 text-primary" /><p>{notice}</p></div>}

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <form onSubmit={save} className="surface p-6 sm:p-8">
          <div className="space-y-5">
            <label className="block text-sm font-medium text-foreground">Name<input value={profile.name} onChange={(event) => updateProfile('name', event.target.value)} placeholder="Mona Octocat" className="mt-2 block w-full rounded-lg border border-border bg-background/75 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/70 focus:ring-1 focus:ring-primary/30" /></label>
            <label className="block text-sm font-medium text-foreground">LinkedIn profile<input value={profile.linkedin} onChange={(event) => updateProfile('linkedin', event.target.value)} placeholder="https://www.linkedin.com/in/your-handle" autoCapitalize="off" autoCorrect="off" className="mt-2 block w-full rounded-lg border border-border bg-background/75 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/70 focus:ring-1 focus:ring-primary/30" /></label>
          </div>
          <button type="submit" disabled={!connected || saving} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/45 bg-primary/10 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary/15 disabled:opacity-40"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save contact card'}</button>
        </form>

        <section className="surface p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><h2 className="text-xl">Collected contacts</h2><p className="mt-2 text-sm text-muted-foreground">{contactCount} contact{contactCount === 1 ? '' : 's'} stored on this badge.</p></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void refresh()} disabled={!connected || loadingContacts} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 font-mono text-xs text-foreground hover:border-primary/60 disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${loadingContacts ? 'animate-spin' : ''}`} />Refresh</button>
              <button type="button" onClick={download} disabled={!csv} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 font-mono text-xs text-foreground hover:border-primary/60 disabled:opacity-40"><Download className="h-4 w-4" />CSV</button>
              <button type="button" onClick={() => void clearContacts()} disabled={!connected} className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 px-3 py-2 font-mono text-xs text-red-300 hover:bg-red-400/5 disabled:opacity-40"><Trash2 className="h-4 w-4" />Clear</button>
            </div>
          </div>
          {contacts.length ? <div className="mt-6 overflow-x-auto rounded-lg border border-border/60"><table className="w-full min-w-[520px] border-collapse text-left text-sm"><thead><tr className="border-b border-border/60 bg-background/60 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground"><th className="px-4 py-3 font-normal">Name</th><th className="px-4 py-3 font-normal">LinkedIn</th></tr></thead><tbody>{contacts.map((cells, index) => <tr key={`${cells[0]}-${index}`} className="border-b border-border/40 last:border-0"><td className="px-4 py-3 text-foreground">{cells[0]}</td><td className="px-4 py-3">{validLinkedIn(cells[1] || '') ? <a href={cells[1]} target="_blank" rel="noreferrer" className="text-primary hover:underline">{cells[1].replace(/^https:\/\/(www\.)?/, '')}</a> : <span className="text-muted-foreground">{cells[1]}</span>}</td></tr>)}</tbody></table></div> : <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center text-sm leading-6 text-muted-foreground">{connected ? 'No exchanged contacts are stored on this badge yet.' : 'Connect to preview the badge contact list.'}</div>}
        </section>
      </div>
    </div>
  )
}
