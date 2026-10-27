import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { getInstallableAppFolders, validateAppCatalog } from '../src/lib/github-app-catalog.ts'
import { APP_DESCRIPTIONS_PATH, descriptionsForCatalog, writeJsonFile } from './sync-app-descriptions.mjs'

const exec = promisify(execFile)
const OUTPUT_PATH = fileURLToPath(new URL('../public/app-catalog.json', import.meta.url))

export async function syncAppCatalog({
  sourcePath = process.env.BADGER_HOME_PATH,
  outputPath = OUTPUT_PATH,
  descriptionsPath = APP_DESCRIPTIONS_PATH,
} = {}) {
  if (!sourcePath) throw new Error('Provide the badger/home checkout path as an argument or BADGER_HOME_PATH.')
  const options = { cwd: resolve(sourcePath), maxBuffer: 16 * 1024 * 1024 }
  const git = async (...args) => (await exec('git', args, options)).stdout
  const revision = (await git('rev-parse', '--verify', 'HEAD')).trim()
  const tree = (await git('ls-tree', '-r', '-z', revision, '--', 'badge/apps'))
    .split('\0').filter(Boolean).map((entry) => {
      const separator = entry.indexOf('\t')
      if (separator < 0 || !/^100(?:644|755) blob [a-f0-9]{40}$/.test(entry.slice(0, separator))) {
        throw new Error('App files must be regular files, not symlinks or submodules.')
      }
      return { path: entry.slice(separator + 1), type: 'blob' }
    })
  const paths = new Set(tree.map((entry) => entry.path))
  let existing = {}
  try {
    existing = JSON.parse(await readFile(descriptionsPath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const descriptions = await descriptionsForCatalog({ tree, truncated: false }, {
    ref: revision,
    existing,
    readReadme: async (ref, name, file) => {
      const path = `badge/apps/${name}/${file}`
      return paths.has(path) ? git('show', `${ref}:${path}`) : null
    },
  })
  const catalog = validateAppCatalog({
    revision,
    apps: getInstallableAppFolders(tree)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, files]) => ({
        name,
        files: files.sort(),
        ...(Object.hasOwn(descriptions, name) ? { description: descriptions[name] } : {}),
      })),
  })
  const descriptionsChanged = await writeJsonFile(descriptionsPath, descriptions)
  const changed = await writeJsonFile(outputPath, catalog)
  return { changed: changed || descriptionsChanged, count: catalog.apps.length, revision }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await syncAppCatalog({ sourcePath: process.argv[2] || process.env.BADGER_HOME_PATH })
    console.log(`${result.changed ? 'Updated' : 'Unchanged'}: ${result.count} apps from badger/home at ${result.revision}.`)
  } catch (error) {
    console.error(`App catalog update failed: ${error.message}`)
    process.exitCode = 1
  }
}
