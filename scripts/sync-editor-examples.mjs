import { mkdir, writeFile, rm, rename } from 'node:fs/promises'
import { adaptExampleSource, exampleAssetDestination, simulatorRevision as revision } from './editor-example-source.mjs'

const base = `https://raw.githubusercontent.com/pimoroni/badgeware-web-simulator/${revision}/`
const read = async path => {
  const response = await fetch(base + path)
  if (!response.ok) throw new Error(`Could not read ${path}: HTTP ${response.status}`)
  return response
}
const manifest = await (await read('simulator/examples/manifest.json')).json()
const target = new URL('../public/editor-examples/', import.meta.url)
const staging = new URL('../public/.editor-examples-staging/', import.meta.url)
await rm(staging, { recursive: true, force: true })
await mkdir(staging, { recursive: true })
try {
  for (const category of manifest.categories) {
    for (const example of category.examples) {
      if (!/^[a-z0-9_]+\.py$/.test(example.file)) throw new Error('Unsafe example filename')
      const source = adaptExampleSource(example.file, await (await read(`simulator/examples/${example.file}`)).text())
      example.assets = [...new Set([...source.matchAll(/["']\/system\/(assets\/[^"']+)["']/g)].map(match => match[1]))]
      await writeFile(new URL(example.file, staging), source)
      for (const asset of example.assets) {
        const file = exampleAssetDestination(asset, staging)
        await mkdir(new URL('.', file), { recursive: true })
        await writeFile(file, new Uint8Array(await (await read(`simulator/filesystem/system/${asset}`)).arrayBuffer()))
      }
    }
  }
  await writeFile(new URL('LICENSE', staging), await (await read('LICENSE')).text())
  await writeFile(new URL('catalog.json', staging), JSON.stringify({ ...manifest, revision }, null, 2) + '\n')
  await rm(target, { recursive: true, force: true })
  await rename(staging, target)
  console.log(`Synced ${manifest.categories.reduce((count, category) => count + category.examples.length, 0)} editor examples at ${revision}`)
} catch (error) {
  await rm(staging, { recursive: true, force: true })
  throw error
}
