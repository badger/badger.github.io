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
// Device builds ship compiled .mpy modules with their sources in src/; the
// simulator cannot load .mpy, so stage src/<module>.py in place of <module>.mpy.
const menuPaths = tree.tree
  .filter(entry => entry.type === 'blob' && entry.path.startsWith('badge/apps/menu/'))
  .map(entry => entry.path.slice('badge/apps/menu/'.length))
  .filter(path => path !== 'README.md' && !path.endsWith('/.DS_Store'))
const menuSources = new Set(menuPaths.filter(path => /^src\/[^/]+\.py$/.test(path)).map(path => path.slice(4, -3)))
const launcherSources = menuPaths
  .filter(path => !(path.endsWith('.mpy') && menuSources.has(path.slice(0, -4))))
  .map(path => path.startsWith('src/') && menuSources.has(path.slice(4, -3)) ? { path: path.slice(4), source: path } : { path, source: path })
  .sort((a, b) => a.path.localeCompare(b.path))
const launcherFiles = launcherSources.map(file => file.path)
if (!launcherFiles.includes('__init__.py')) throw new Error('Could not find the launcher menu app.')
const missingSources = menuPaths.filter(path => path.endsWith('.mpy') && !menuSources.has(path.slice(0, -4)))
if (missingSources.length) throw new Error(`Launcher modules have no source: ${missingSources.join(', ')}`)
// The menu ships an animated icon for each stock app; the simulator shows only those.
const stock = launcherFiles
  .filter(path => /^anim\/[^/]+\.bin$/.test(path))
  .map(path => path.slice(5, -4))
  .filter(name => folders.some(([folder]) => folder === name))
  .sort()
if (!stock.length) throw new Error('Could not find the stock app list.')
const target = new URL('../public/editor-apps/', import.meta.url)
const staging = new URL('../public/.editor-apps-staging/', import.meta.url)
await rm(staging, { recursive: true, force: true })
await mkdir(staging, { recursive: true })
try {
  const downloads = [
    ...folders.map(([name, paths]) => [name, paths.map(path => ({ path, source: path }))]),
    ['menu', launcherSources],
  ]
  for (const [name, paths] of downloads) {
    let next = 0
    await Promise.all(Array.from({ length: Math.min(6, paths.length) }, async () => {
      while (next < paths.length) {
        const { path, source } = paths[next++]
        const response = await fetch(`https://raw.githubusercontent.com/badger/home/${tree.sha}/badge/apps/${name}/${source.split('/').map(encodeURIComponent).join('/')}`)
        if (!response.ok) throw new Error(`Could not read ${name}/${source}: HTTP ${response.status}`)
        const file = new URL(`${name}/${path}`, staging)
        await mkdir(new URL('.', file), { recursive: true })
        await writeFile(file, new Uint8Array(await response.arrayBuffer()))
      }
    }))
  }
  const license = await fetch(`https://raw.githubusercontent.com/badger/home/${tree.sha}/LICENSE`)
  if (!license.ok) throw new Error('Could not read app license')
  await writeFile(new URL('LICENSE', staging), await license.text())
  await writeFile(new URL('catalog.json', staging), JSON.stringify({ revision: tree.sha, launcher: { name: 'menu', title: 'Menu', files: launcherFiles, stock }, apps: folders.map(([name, files]) => ({ name, title: name.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()), files: files.sort() })) }, null, 2) + '\n')
  const { cp, rename } = await import('node:fs/promises')
  await rm(target, { recursive: true, force: true })
  try {
    await rename(staging, target)
  } catch (error) {
    // Windows file watchers (e.g. a running dev server) can block directory renames.
    if (error?.code !== 'EPERM' && error?.code !== 'EBUSY') throw error
    await cp(staging, target, { recursive: true })
    await rm(staging, { recursive: true, force: true })
  }
  console.log(`Synced ${folders.length} editor apps from badger/home at ${tree.sha}`)
} catch (error) {
  await rm(staging, { recursive: true, force: true })
  throw error
}
