import { mkdir, writeFile, rm } from 'node:fs/promises'
import { getInstallableAppFolders, GITHUB_APPS_TREE_URL } from '../src/lib/github-app-catalog.ts'

const treeResponse = await fetch(GITHUB_APPS_TREE_URL)
if (!treeResponse.ok) throw new Error(`Could not read app catalog: HTTP ${treeResponse.status}`)
const tree = await treeResponse.json()
if (tree.truncated !== false || !Array.isArray(tree.tree)) {
  throw new Error('Could not read a complete app catalog tree.')
}
const folders = getInstallableAppFolders(tree.tree).sort(([a], [b]) => a.localeCompare(b))
// The launcher menu is not installable, but the about-badge simulator runs it.
const launcherFiles = tree.tree
  .filter(entry => entry.type === 'blob' && entry.path.startsWith('badge/apps/menu/'))
  .map(entry => entry.path.slice('badge/apps/menu/'.length))
  .filter(path => path === 'default_icon.png' || /^[^/]+\.py$/.test(path))
  .sort()
if (!launcherFiles.includes('__init__.py')) throw new Error('Could not find the launcher menu app.')
const target = new URL('../public/editor-apps/', import.meta.url)
const staging = new URL('../public/.editor-apps-staging/', import.meta.url)
await rm(staging, { recursive: true, force: true })
await mkdir(staging, { recursive: true })
try {
  for (const [name, paths] of [...folders, ['menu', launcherFiles]]) {
    let next = 0
    await Promise.all(Array.from({ length: Math.min(6, paths.length) }, async () => {
      while (next < paths.length) {
        const path = paths[next++]
        const response = await fetch(`https://raw.githubusercontent.com/badger/home/${tree.sha}/badge/apps/${name}/${path.split('/').map(encodeURIComponent).join('/')}`)
        if (!response.ok) throw new Error(`Could not read ${name}/${path}: HTTP ${response.status}`)
        const file = new URL(`${name}/${path}`, staging)
        await mkdir(new URL('.', file), { recursive: true })
        await writeFile(file, new Uint8Array(await response.arrayBuffer()))
      }
    }))
  }
  const license = await fetch(`https://raw.githubusercontent.com/badger/home/${tree.sha}/LICENSE`)
  if (!license.ok) throw new Error('Could not read app license')
  await writeFile(new URL('LICENSE', staging), await license.text())
  await writeFile(new URL('catalog.json', staging), JSON.stringify({ revision: tree.sha, launcher: { name: 'menu', title: 'Menu', files: launcherFiles }, apps: folders.map(([name, files]) => ({ name, title: name.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()), files: files.sort() })) }, null, 2) + '\n')
  const { rename } = await import('node:fs/promises')
  await rm(target, { recursive: true, force: true })
  await rename(staging, target)
  console.log(`Synced ${folders.length} editor apps from badger/home at ${tree.sha}`)
} catch (error) {
  await rm(staging, { recursive: true, force: true })
  throw error
}
