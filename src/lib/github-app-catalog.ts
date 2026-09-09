export const GITHUB_APPS_TREE_URL = 'https://api.github.com/repos/badger/home/git/trees/main?recursive=1'

export type GitHubTreeEntry = {
  path: string
  type: string
}

export function getInstallableAppFolders(tree: GitHubTreeEntry[]) {
  const folders = new Map<string, string[]>()

  for (const entry of tree) {
    if (entry.type !== 'blob' || !entry.path.startsWith('badge/apps/')) continue
    if (entry.path.includes('/__pycache__/') || entry.path.endsWith('.pyc') || entry.path.endsWith('/.DS_Store')) continue
    const [, , name, ...filePath] = entry.path.split('/')
    if (!name || !filePath.length || name === 'menu' || name === 'startup') continue
    folders.set(name, [...(folders.get(name) ?? []), filePath.join('/')])
  }

  return [...folders.entries()].filter(([, files]) => files.includes('__init__.py'))
}

export async function fetchInstallableAppFolders() {
  const response = await fetch(GITHUB_APPS_TREE_URL)
  if (!response.ok) throw new Error(`GitHub app catalog request failed with ${response.status}`)
  const payload = await response.json() as { tree?: GitHubTreeEntry[] }
  return getInstallableAppFolders(payload.tree ?? [])
}
