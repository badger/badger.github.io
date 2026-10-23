export const GITHUB_APPS_TREE_URL = 'https://api.github.com/repos/badger/home/git/trees/main?recursive=1'
export const APP_CATALOG_URL = '/app-catalog.json'

export type GitHubTreeEntry = {
  path: string
  type: string
}

export type AppCatalog = {
  revision: string
  apps: {
    name: string
    files: string[]
    description?: string
  }[]
}

export function getInstallableAppFolders(tree: GitHubTreeEntry[]) {
  const folders = new Map<string, string[]>()

  for (const entry of tree) {
    if (entry.type !== 'blob' || !entry.path.startsWith('badge/apps/')) continue
    if (entry.path.includes('/__pycache__/') || entry.path.endsWith('.pyc') || entry.path.endsWith('/.DS_Store')) continue
    const [, , name, ...filePath] = entry.path.split('/')
    if (!name || !filePath.length || ['menu', 'startup', 'quest'].includes(name)) continue
    folders.set(name, [...(folders.get(name) ?? []), filePath.join('/')])
  }

  return [...folders.entries()].filter(([, files]) => files.includes('__init__.py'))
}

export function validateAppCatalog(value: unknown): AppCatalog {
  const catalog = value as AppCatalog | null
  if (!catalog || typeof catalog !== 'object' || typeof catalog.revision !== 'string' || !/^[a-f0-9]{40}$/.test(catalog.revision)
    || !Array.isArray(catalog.apps) || !catalog.apps.length) {
    throw new Error('The published app catalog is incomplete or invalid.')
  }

  const names = new Set<string>()
  for (const app of catalog.apps) {
    if (!app || typeof app.name !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(app.name)
      || ['menu', 'startup', 'quest', 'constructor', 'prototype'].includes(app.name)
      || names.has(app.name) || !Array.isArray(app.files) || !app.files.includes('__init__.py')
      || new Set(app.files).size !== app.files.length
      || app.files.some((path) => typeof path !== 'string' || /[\\\u0000-\u001f\u007f]/.test(path)
        || path.split('/').some((part) => !part || part === '.' || part === '..'))
      || (app.description !== undefined && (typeof app.description !== 'string' || !app.description.trim()
        || app.description !== app.description.trim() || /[\u0000-\u001f\u007f]/.test(app.description)))) {
      throw new Error('The published app catalog contains an invalid app.')
    }
    names.add(app.name)
  }
  return catalog
}

export async function fetchAppCatalog({ refresh = false }: { refresh?: boolean } = {}) {
  const response = await fetch(APP_CATALOG_URL, { cache: refresh ? 'no-store' : 'no-cache' })
  if (!response.ok) throw new Error(`App catalog request failed with ${response.status}`)
  return validateAppCatalog(await response.json())
}

export function appFileUrl(revision: string, name: string, path: string) {
  return `https://raw.githubusercontent.com/badger/home/${revision}/badge/apps/${encodeURIComponent(name)}/${path.split('/').map(encodeURIComponent).join('/')}`
}
