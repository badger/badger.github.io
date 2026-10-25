import { sitePath } from './site-path'

const guidePaths = new Map([
  ['copilot-app', '/build/app'],
  ['vscode', '/build/vscode'],
  ['copilot-cli', '/build/cli'],
])

export function legacyBuildGuidePath(fragment: string) {
  try {
    const tool = decodeURIComponent(fragment.replace(/^#/, '')).replace(/^(windows|mac)-/, '')
    const path = guidePaths.get(tool)
    return path ? sitePath(path) : undefined
  } catch {
    return undefined
  }
}
