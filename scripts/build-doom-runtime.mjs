import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const SOURCE_REVISION = 'a77edfd8bbc7e66b119a49c954f69a8b24e59206'
const DEPLOYMENT_REVISION = '5b1e1fe7385b6f0b19d60dece6adbf88f6842e20'
const expected = {
  engineJavaScript: 'a5a10b9bc2ad755f068e4ed9e3556caa44d82a2d2f50d61139e6f0903c69f87f',
  wasm: 'f95f19c3887991db8a2e0f8c5d365b6dd15c49bd38bc5417a6606be3aed83be2',
  config: 'eacd68e8e254bd250bc559c1535ab88df437340d0460cae6085f5f29b49fb6e2',
  license: 'edaef632cbb643e4e7a221717a6c441a4c1a7c918e6e4d56debc3d8739b233f6',
  wad: '1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771',
  wadLicense: 'e3cb48b4b498e96371b27b099076fe3ae0e9d0d12b08afcd0d20dac4cee5abf7',
}

const [engineJavaScriptPath, wasmPath, configPath, licensePath, wadPath, wadLicensePath] = process.argv.slice(2)
if (!wadLicensePath) {
  console.error('Usage: npm run build:doom-runtime -- /path/to/websockets-doom.js /path/to/websockets-doom.wasm /path/to/default.cfg /path/to/COPYING.txt /path/to/DOOM1.WAD /path/to/DOOM1-SHAREWARE.txt')
  process.exit(2)
}

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const readPinned = async (path, sha256, label) => {
  const bytes = await readFile(resolve(path))
  const actual = digest(bytes)
  if (actual !== sha256) throw new Error(`${label} SHA-256 mismatch: expected ${sha256}, received ${actual}.`)
  return bytes
}
const artifact = (path, bytes) => ({ path, size: bytes.byteLength, sha256: digest(bytes) })

const [engineJavaScript, wasm, config, license, wad, wadLicense] = await Promise.all([
  readPinned(engineJavaScriptPath, expected.engineJavaScript, 'Engine JavaScript'),
  readPinned(wasmPath, expected.wasm, 'Engine WebAssembly'),
  readPinned(configPath, expected.config, 'Engine configuration'),
  readPinned(licensePath, expected.license, 'GPL license'),
  readPinned(wadPath, expected.wad, 'DOOM1.WAD'),
  readPinned(wadLicensePath, expected.wadLicense, 'Doom shareware license'),
])
if (wad.byteLength !== 4_196_020) throw new Error(`DOOM1.WAD size mismatch: received ${wad.byteLength}.`)

const configText = config.toString('utf8')
  .replace(/^key_fire\s+\d+/m, 'key_fire                      29')
  .replace(/^key_use\s+\d+/m, 'key_use                       57')
const prefix = `const KEYBOARD = {
  ArrowLeft: ['ArrowLeft', 'ArrowLeft', 37],
  ArrowRight: ['ArrowRight', 'ArrowRight', 39],
  ArrowUp: ['ArrowUp', 'ArrowUp', 38],
  ArrowDown: ['ArrowDown', 'ArrowDown', 40],
  ControlLeft: ['Control', 'ControlLeft', 17],
  Space: [' ', 'Space', 32],
  ShiftLeft: ['Shift', 'ShiftLeft', 16],
  AltLeft: ['Alt', 'AltLeft', 18],
  Escape: ['Escape', 'Escape', 27],
  Enter: ['Enter', 'Enter', 13],
}

export function createDoomRuntime(options) {
  return new Promise((resolve, reject) => {
    const { canvas, wad, wasm, onFrame } = options
    const originalCanvasId = canvas.id
    if (!canvas.id) canvas.id = 'canvas'
    let disposed = false
    let paused = false
    const held = new Set()
    const dispatchKey = (key, pressed) => {
      const definition = KEYBOARD[key]
      if (!definition || disposed) return
      if (pressed) held.add(key)
      else held.delete(key)
      const event = new KeyboardEvent(pressed ? 'keydown' : 'keyup', {
        key: definition[0],
        code: definition[1],
        keyCode: definition[2],
        which: definition[2],
        bubbles: true,
        cancelable: true,
      })
      try {
        Object.defineProperty(event, 'keyCode', { get: () => definition[2] })
        Object.defineProperty(event, 'which', { get: () => definition[2] })
      } catch {}
      document.dispatchEvent(event)
    }
    const syncFileSystem = populate => new Promise((syncResolve, syncReject) => {
      if (typeof FS === 'undefined' || typeof FS.syncfs !== 'function') {
        syncResolve()
        return
      }
      FS.syncfs(populate, error => error ? syncReject(error) : syncResolve())
    })
    const setAudioPaused = value => {
      const context = Module.SDL2?.audioContext
      if (!context || context.state === 'closed') return
      context[value ? 'suspend' : 'resume']().catch(error => console.warn('[doom] Audio state could not be updated.', error))
    }
    const api = {
      key: dispatchKey,
      pause() {
        if (disposed || paused) return
        paused = true
        setAudioPaused(true)
      },
      resume() {
        if (disposed || !paused) return
        paused = false
        setAudioPaused(false)
      },
      syncSaves() {
        return syncFileSystem(false)
      },
      dispose() {
        if (disposed) return
        for (const key of held) dispatchKey(key, false)
        held.clear()
        disposed = true
        setAudioPaused(true)
        if (!originalCanvasId) canvas.removeAttribute('id')
      },
    }
    var Module = {
      canvas,
      noInitialRun: true,
      noExitRuntime: true,
      wasmBinary: wasm,
      print: message => console.info('[doom]', message),
      printErr: message => console.warn('[doom]', message),
      onAbort: reason => reject(new Error(\`Doom runtime aborted: \${reason}\`)),
      // Let an Asyncify-suspended frame finish before stopping native iterations.
      preMainLoop() {
        if (disposed) Browser.mainLoop.pause()
        return !disposed && !paused
      },
      postMainLoop() {
        if (!disposed && !paused) onFrame()
      },
      preRun() {
        if (options.audioContext) Module.SDL2 = { audioContext: options.audioContext }
        FS.createDataFile('/', 'DOOM1.WAD', wad, true, true, true)
        FS.createDataFile('/', 'default.cfg', ${JSON.stringify(configText)}, true, true)
        try { FS.mkdir('/doom-saves') } catch {}
        if (typeof IDBFS !== 'undefined') {
          try {
            FS.mount(IDBFS, {}, '/doom-saves')
            addRunDependency('doom-idbfs')
            FS.syncfs(true, error => {
              if (error) console.warn('[doom] Save data could not be restored.', error)
              removeRunDependency('doom-idbfs')
            })
          } catch (error) {
            console.warn('[doom] Persistent saves are unavailable.', error)
          }
        }
      },
      onRuntimeInitialized() {
        try {
          if (typeof EGL !== 'undefined') EGL.contextAttributes.preserveDrawingBuffer = true
          callMain([
            '-iwad', 'DOOM1.WAD',
            '-window',
            '-width', '320',
            '-height', '200',
            '-nogui',
            '-config', 'default.cfg',
            '-savedir', '/doom-saves',
          ])
        } catch (error) {
          if (error !== 'unwind') {
            reject(error)
            return
          }
        }
        resolve(api)
      },
    }
`
const suffix = `
  })
}
`
const adapter = Buffer.from(`${prefix}\n${engineJavaScript.toString('utf8').replace(/[ \t]+$/gm, '')}\n${suffix}`)
const sourceEvidence = Buffer.from(`# Doom WebAssembly corresponding source

The committed engine is rebuilt with Emscripten 3.1.45 from the source revision
below, with \`OPL-WEBAUDIO.patch\` applied. The patch advances the emulated OPL
timer synchronously during hardware detection, avoiding a desktop condition-variable
wait that deadlocks the browser's WebAudio callback. Native builds are unchanged.
\`doom.mjs\` adds the adapter generated by \`scripts/build-doom-runtime.mjs\`.

Engine lineage:

- Deployment: https://github.com/Saketh-Chandra/doom-wasm-pwa/tree/${DEPLOYMENT_REVISION}
- Corresponding source: https://github.com/Saketh-Chandra/doom-wasm-pwa/tree/${SOURCE_REVISION}
- Original port: https://github.com/cloudflare/doom-wasm
- Engine lineage: https://github.com/chocolate-doom/chocolate-doom

Rebuild with Emscripten 3.1.45, Autoconf, Automake, and pkg-config available:

\`\`\`sh
git clone https://github.com/Saketh-Chandra/doom-wasm-pwa.git
cd doom-wasm-pwa
git checkout ${SOURCE_REVISION}
patch -p1 < /path/to/OPL-WEBAUDIO.patch
export EM_COMPILER_WRAPPER=/path/to/badger.github.io/scripts/doom-compiler-wrapper.sh
emcc --clear-cache
emconfigure autoreconf -fiv
ac_cv_exeext=.html emconfigure ./configure --host=none-none-none \\
  --disable-icons --disable-doc --disable-bash-completion \\
  --without-libsamplerate --without-libpng
emmake make -j4
$EMSDK/upstream/bin/wasm-opt --strip-debug src/websockets-doom.wasm -o /path/to/websockets-doom.wasm
\`\`\`

Use the pinned original \`default.cfg\` from
\`danborden1/doom-web@e0ba81004e27e7d66141925dfebb091a558e2fe8\`, then run:

\`\`\`sh
npm run build:doom-runtime -- \\
  /path/to/websockets-doom.js \\
  /path/to/websockets-doom.wasm \\
  /path/to/default.cfg \\
  /path/to/COPYING.txt \\
  /path/to/DOOM1.WAD \\
  /path/to/DOOM1-SHAREWARE.txt
\`\`\`

The build command rejects inputs that do not match the reviewed upstream
artifact hashes before producing the public runtime.
`)

await mkdir('public/doom/runtime', { recursive: true })
await mkdir('public/doom/licenses', { recursive: true })
await mkdir('config', { recursive: true })
await Promise.all([
  writeFile('public/doom/runtime/doom.mjs', adapter),
  copyFile(resolve(wasmPath), 'public/doom/runtime/doom.wasm'),
  copyFile(resolve(licensePath), 'public/doom/runtime/COPYING.txt'),
  writeFile('public/doom/runtime/SOURCE.md', sourceEvidence),
  copyFile(resolve(wadPath), 'public/doom/DOOM1.WAD'),
  copyFile(resolve(wadLicensePath), 'public/doom/licenses/DOOM1-SHAREWARE.txt'),
])

const approval = {
  schemaVersion: 1,
  engine: 'WebSockets Doom (Chocolate Doom port)',
  engineVersion: '0.0.1',
  upstreamSourceRevision: SOURCE_REVISION,
  upstreamSourceUrl: `https://github.com/Saketh-Chandra/doom-wasm-pwa/tree/${SOURCE_REVISION}`,
  emscriptenVersion: '3.1.45',
  adapterContractVersion: 1,
  javascript: artifact('/doom/runtime/doom.mjs', adapter),
  wasm: artifact('/doom/runtime/doom.wasm', wasm),
  license: artifact('/doom/runtime/COPYING.txt', license),
  correspondingSource: artifact('/doom/runtime/SOURCE.md', sourceEvidence),
}
const manifest = `${JSON.stringify(approval, null, 2)}\n`
await Promise.all([
  writeFile('config/doom-runtime-approved.json', manifest),
  writeFile('public/doom/runtime/manifest.json', manifest),
])
console.log('Built and installed the pinned Doom shareware browser runtime.')
