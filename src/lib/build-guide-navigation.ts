const guidePaths = new Map([
  ['copilot-app', '/build/app'],
  ['vscode', '/build/vscode'],
  ['copilot-cli', '/build/cli'],
])

export function legacyBuildGuidePath(fragment: string) {
  try {
    const tool = decodeURIComponent(fragment.replace(/^#/, '')).replace(/^(windows|mac)-/, '')
    return guidePaths.get(tool)
  } catch {
    return undefined
  }
}
