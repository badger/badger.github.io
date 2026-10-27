import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const assetPattern = /^(?:entry\.[\w-]+\.js|chunks\/chunk\.[\w-]+\.js|assets\/[^/]+\.[\w-]+\.[\w]+)$/

export async function preservePageAssets(current, previous) {
  const ownAssets = (await readdir(current, { recursive: true })).filter(path => assetPattern.test(path)).sort()
  const present = new Set(ownAssets)
  for (const directory of previous) {
    let paths
    try {
      paths = JSON.parse(await readFile(resolve(directory, 'page-assets.json'), 'utf8'))
      if (!Array.isArray(paths)) throw new Error('Invalid page asset manifest')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      paths = await readdir(directory, { recursive: true })
    }
    for (const path of paths) {
      if (typeof path !== 'string' || !assetPattern.test(path) || present.has(path)) continue
      const destination = resolve(current, path)
      await mkdir(dirname(destination), { recursive: true })
      await copyFile(resolve(directory, path), destination)
      present.add(path)
    }
  }
  await writeFile(resolve(current, 'page-assets.json'), JSON.stringify(ownAssets))
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  await preservePageAssets(resolve(process.argv[2] || 'dist'), process.argv.slice(3).map(path => resolve(path)))
}
