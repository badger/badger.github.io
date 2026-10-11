import { mkdir, writeFile, rm } from 'node:fs/promises'
import { getInstallableAppFolders, GITHUB_APPS_TREE_URL } from '../src/lib/github-app-catalog.ts'

const treeResponse = await fetch(GITHUB_APPS_TREE_URL)
if (!treeResponse.ok) throw new Error(`Could not read app catalog: HTTP ${treeResponse.status}`)
const tree = await treeResponse.json()
const folders = getInstallableAppFolders(tree.tree || []).sort(([a], [b]) => a.localeCompare(b))
const target = new URL('../public/editor-apps/', import.meta.url)
const staging = new URL('../public/.editor-apps-staging/', import.meta.url)
await rm(staging, { recursive: true, force: true })
await mkdir(staging, { recursive: true })
try {
  for (const [name, paths] of folders) {
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
  await writeFile(new URL('catalog.json', staging), JSON.stringify({ revision: tree.sha, apps: folders.map(([name, files]) => ({ name, title: name.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()), files: files.sort() })) }, null, 2) + '\n')
  const { rename } = await import('node:fs/promises')
  await rm(target, { recursive: true, force: true })
  await rename(staging, target)
  console.log(`Synced ${folders.length} editor apps from badger/home at ${tree.sha}`)
} catch (error) {
  await rm(staging, { recursive: true, force: true })
  throw error
}
