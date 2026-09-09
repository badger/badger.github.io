export type BluetoothCharacteristic = EventTarget & {
  value?: DataView
  startNotifications: () => Promise<BluetoothCharacteristic>
  writeValue: (value: BufferSource) => Promise<void>
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>
}

export type BluetoothService = {
  getCharacteristic: (uuid: string) => Promise<BluetoothCharacteristic>
}

export type BluetoothServer = {
  connected: boolean
  connect: () => Promise<BluetoothServer>
  disconnect: () => void
  getPrimaryService: (uuid: string) => Promise<BluetoothService>
}

export type BluetoothDevice = EventTarget & {
  name?: string
  gatt?: BluetoothServer
}

type BluetoothNavigator = {
  requestDevice: (options: {
    filters: Array<{ services: string[] }>
    optionalServices?: string[]
  }) => Promise<BluetoothDevice>
}

declare global {
  interface Navigator {
    bluetooth?: BluetoothNavigator
  }
}

export type FramedMessage = Record<string, unknown>

export function encodeFrame(message: FramedMessage) {
  const body = new TextEncoder().encode(JSON.stringify(message))
  const frame = new Uint8Array(4 + body.length)
  new DataView(frame.buffer).setUint32(0, body.length, false)
  frame.set(body, 4)
  return { body, frame }
}

export async function writeFrame(characteristic: BluetoothCharacteristic, message: FramedMessage) {
  const { body, frame } = encodeFrame(message)
  let chunks = 0
  for (let offset = 0; offset < frame.length; offset += 180) {
    const part = frame.slice(offset, offset + 180)
    if (characteristic.writeValueWithoutResponse) await characteristic.writeValueWithoutResponse(part)
    else await characteristic.writeValue(part)
    chunks += 1
  }
  return { bytes: body.length, chunks }
}

export function notificationBytes(event: Event) {
  const value = (event.target as BluetoothCharacteristic).value
  if (!value) return new Uint8Array()
  return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
}

export function decodeFrames(prior: Uint8Array, incoming: Uint8Array) {
  const merged = new Uint8Array(prior.length + incoming.length)
  merged.set(prior)
  merged.set(incoming, prior.length)
  const messages: FramedMessage[] = []
  let rest = merged
  while (rest.length >= 4) {
    const length = new DataView(rest.buffer, rest.byteOffset, 4).getUint32(0, false)
    if (length > 65536) throw new Error('Badge sent an invalid message length.')
    if (rest.length < length + 4) break
    const body = rest.slice(4, length + 4)
    messages.push(JSON.parse(new TextDecoder().decode(body)) as FramedMessage)
    rest = rest.slice(length + 4)
  }
  return { messages, rest }
}
