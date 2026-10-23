import { DOOM_SHAREWARE_WAD, validateRuntimeManifest, verifyArtifact, type DoomRuntimeManifest } from './doom-assets'
import type { DoomKey } from './doom-input'
import { sitePath } from './site-path'

export interface DoomRuntime {
  key(key: DoomKey, pressed: boolean): void
  pause(): void
  resume(): void
  syncSaves(): Promise<void>
  dispose(): void
}

export interface DoomRuntimeFactory {
  createDoomRuntime(options: {
    canvas: HTMLCanvasElement
    wad: Uint8Array
    wasm: Uint8Array
    saveDirectory: '/doom-saves'
    audioContext?: AudioContext
    onFrame(): void
  }): Promise<DoomRuntime>
}

async function fetchBytes(path: string, signal: AbortSignal) {
  const response = await fetch(sitePath(path), { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`Required Doom artifact is unavailable: ${path} (HTTP ${response.status}).`)
  return response.arrayBuffer()
}

async function importVerifiedAdapter(javascript: ArrayBuffer, signal: AbortSignal) {
  signal.throwIfAborted()
  let url: string
  try {
    url = URL.createObjectURL(new Blob([javascript], { type: 'text/javascript' }))
  } catch (error) {
    signal.throwIfAborted()
    throw new Error('The verified Doom engine adapter could not be prepared for evaluation.', { cause: error })
  }
  try {
    const module = await import(/* @vite-ignore */ url) as DoomRuntimeFactory
    signal.throwIfAborted()
    return module
  } catch (error) {
    signal.throwIfAborted()
    throw new Error('The verified Doom engine adapter could not be evaluated.', { cause: error })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function loadDoomRuntime(canvas: HTMLCanvasElement, signal: AbortSignal, base = '/doom', audioContext?: AudioContext, onFrame = () => {}) {
  const response = await fetch(sitePath(`${base}/runtime/manifest.json`), { signal, cache: 'no-store' })
  if (!response.ok) throw new Error('Verified Doom engine artifacts are not installed.')
  const manifest = validateRuntimeManifest(await response.json())
  const [wad, javascript, wasm] = await Promise.all([
    fetchBytes(`${base}/DOOM1.WAD`, signal),
    fetchBytes(manifest.javascript.path, signal),
    fetchBytes(manifest.wasm.path, signal),
  ])
  await Promise.all([
    verifyArtifact(wad, DOOM_SHAREWARE_WAD),
    verifyArtifact(javascript, manifest.javascript),
    verifyArtifact(wasm, manifest.wasm),
  ])
  signal.throwIfAborted()
  const module = await importVerifiedAdapter(javascript, signal)
  if (typeof module.createDoomRuntime !== 'function') throw new Error('The Doom engine adapter export is missing.')
  const runtime = await module.createDoomRuntime({
    canvas,
    wad: new Uint8Array(wad),
    wasm: new Uint8Array(wasm),
    saveDirectory: '/doom-saves',
    audioContext,
    onFrame,
  })
  if (signal.aborted) {
    runtime.dispose()
    signal.throwIfAborted()
  }
  return runtime
}

export function describeRuntime(manifest: DoomRuntimeManifest) {
  return `Approved ${manifest.engine} ${manifest.engineVersion} · Emscripten ${manifest.emscriptenVersion}`
}
