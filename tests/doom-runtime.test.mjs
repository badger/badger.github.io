import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'

const compiled = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/doom-runtime.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false })
const { loadDoomRuntime } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

test('bundled engine enables Doom music with the built-in OPL synthesizer', async () => {
  const adapter = await readFile(new URL('../public/doom/runtime/doom.mjs', import.meta.url), 'utf8')
  const arguments_ = adapter.match(/callMain\(\[([\s\S]*?)\]\)/)[1]
  assert.doesNotMatch(arguments_, /-nomusic|-nosound/)
  const config = JSON.parse(adapter.match(/FS\.createDataFile\('\/', 'default\.cfg', ("(?:[^"\\]|\\.)*")/)[1])
  assert.match(config, /^snd_musicdevice\s+3$/m)
  assert.match(config, /^music_volume\s+[1-9]\d*$/m)
})

test('adapter shares the unlocked audio context and pauses music with the game', async () => {
  const adapter = await readFile(new URL('../public/doom/runtime/doom.mjs', import.meta.url), 'utf8')
  const engineStart = adapter.indexOf('\nvar Module = typeof Module')
  assert.ok(engineStart > 0)
  const stubbed = `${adapter.slice(0, engineStart)}
    var FS = { createDataFile() {}, mkdir() {} }
    var Browser = { mainLoop: {
      func() {},
      pause() { onFrame('pause') },
      resume() { onFrame('resume') },
    } }
    Module.preRun()
    onFrame({
      audioContext: Module.SDL2.audioContext,
      frame() {
        if (Module.preMainLoop?.() === false) return
        onFrame('native-frame')
        Module.postMainLoop()
      },
    })
    resolve(api)
  })
}`
  const { createDoomRuntime } = await import(`data:text/javascript;base64,${Buffer.from(stubbed).toString('base64')}`)
  const events = []
  const audioContext = {
    state: 'running',
    async suspend() { events.push('suspend'); this.state = 'suspended' },
    async resume() { events.push('resume-audio'); this.state = 'running' },
  }
  const runtime = await createDoomRuntime({
    canvas: { id: 'canvas' },
    audioContext,
    onFrame: event => events.push(event ?? 'draw'),
  })
  const loop = events.shift()
  assert.equal(loop.audioContext, audioContext)
  loop.frame()
  runtime.pause()
  runtime.pause()
  loop.frame()
  assert.equal(audioContext.state, 'suspended')
  runtime.resume()
  runtime.resume()
  loop.frame()
  assert.equal(audioContext.state, 'running')
  runtime.dispose()
  runtime.resume()
  loop.frame()
  assert.equal(audioContext.state, 'suspended')
  assert.deepEqual(events, ['native-frame', 'draw', 'suspend', 'resume-audio', 'native-frame', 'draw', 'suspend', 'pause'])
})

test('bundled engine binds single-tap fire to Ctrl and double-tap use to Space', async () => {
  const adapter = await readFile(new URL('../public/doom/runtime/doom.mjs', import.meta.url), 'utf8')
  const config = JSON.parse(adapter.match(/FS\.createDataFile\('\/', 'default\.cfg', ("(?:[^"\\]|\\.)*")/)[1])
  const binding = name => Number(config.match(new RegExp(`^${name}\\s+(\\d+)$`, 'm'))[1])
  assert.equal(binding('key_fire'), 29)
  assert.equal(binding('key_use'), 57)
})

test('missing runtime manifest is an explicit blocker before any WAD request', async () => {
  const requests = []
  const previous = globalThis.fetch
  globalThis.fetch = async path => {
    requests.push(path)
    return { ok: false, status: 404 }
  }
  try {
    await assert.rejects(loadDoomRuntime({}, new AbortController().signal), /engine artifacts are not installed/)
    assert.deepEqual(requests, ['/doom/runtime/manifest.json'])
  } finally {
    globalThis.fetch = previous
  }
})

test('executes the verified JavaScript bytes once and supplies the exact verified WASM bytes', async () => {
  const javascript = Buffer.from(`
    export async function createDoomRuntime(options) {
      globalThis.__doomAdapterCalls.push({
        wasm: [...options.wasm],
        wadLength: options.wad.byteLength,
        saveDirectory: options.saveDirectory,
      })
      return globalThis.__doomRuntime
    }
  `)
  const wasm = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])
  const wad = new Uint8Array(4_196_020)
  const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
  const artifact = (path, bytes) => ({ path, size: bytes.byteLength, sha256: sha256(bytes) })
  const manifest = {
    schemaVersion: 1,
    engine: 'WebSockets Doom (Chocolate Doom port)',
    engineVersion: '0.0.1',
    upstreamSourceRevision: 'a77edfd8bbc7e66b119a49c954f69a8b24e59206',
    upstreamSourceUrl: 'https://github.com/Saketh-Chandra/doom-wasm-pwa/tree/a77edfd8bbc7e66b119a49c954f69a8b24e59206',
    emscriptenVersion: '3.1.45',
    adapterContractVersion: 1,
    license: { path: '/doom/runtime/COPYING.txt', size: 1, sha256: 'a'.repeat(64) },
    correspondingSource: { path: '/doom/runtime/SOURCE.md', size: 1, sha256: 'a'.repeat(64) },
    javascript: artifact('/doom/runtime/doom.mjs', javascript),
    wasm: artifact('/doom/runtime/doom.wasm', wasm),
  }
  const responses = new Map([
    ['/doom/DOOM1.WAD', wad.buffer],
    [manifest.javascript.path, javascript.buffer.slice(javascript.byteOffset, javascript.byteOffset + javascript.byteLength)],
    [manifest.wasm.path, wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength)],
  ])
  const requests = []
  const blobs = []
  const revoked = []
  const runtime = { key() {}, pause() {}, resume() {}, async syncSaves() {}, dispose() {} }
  const previous = {
    fetch: globalThis.fetch,
    crypto: globalThis.crypto,
    createObjectURL: URL.createObjectURL,
    revokeObjectURL: URL.revokeObjectURL,
  }
  globalThis.__doomAdapterCalls = []
  globalThis.__doomRuntime = runtime
  globalThis.fetch = async path => {
    requests.push(path)
    if (path === '/doom/runtime/manifest.json') return { ok: true, json: async () => manifest }
    return { ok: true, arrayBuffer: async () => responses.get(path) }
  }
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      subtle: {
        digest(algorithm, bytes) {
          if (bytes.byteLength === wad.byteLength) {
            return Promise.resolve(Uint8Array.from(Buffer.from('1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771', 'hex')).buffer)
          }
          return webcrypto.subtle.digest(algorithm, bytes)
        },
      },
    },
  })
  URL.createObjectURL = blob => {
    blobs.push(blob)
    return `data:text/javascript;base64,${javascript.toString('base64')}`
  }
  URL.revokeObjectURL = url => revoked.push(url)
  try {
    assert.equal(await loadDoomRuntime({}, new AbortController().signal), runtime)
    assert.deepEqual(requests, [
      '/doom/runtime/manifest.json',
      '/doom/DOOM1.WAD',
      '/doom/runtime/doom.mjs',
      '/doom/runtime/doom.wasm',
    ])
    assert.equal(blobs.length, 1)
    assert.deepEqual(Buffer.from(await blobs[0].arrayBuffer()), javascript)
    assert.deepEqual(revoked, [`data:text/javascript;base64,${javascript.toString('base64')}`])
    assert.deepEqual(globalThis.__doomAdapterCalls, [{
      wasm: [...wasm],
      wadLength: wad.byteLength,
      saveDirectory: '/doom-saves',
    }])
  } finally {
    globalThis.fetch = previous.fetch
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: previous.crypto })
    URL.createObjectURL = previous.createObjectURL
    URL.revokeObjectURL = previous.revokeObjectURL
    delete globalThis.__doomAdapterCalls
    delete globalThis.__doomRuntime
  }
})
