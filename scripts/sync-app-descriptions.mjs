import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { getInstallableAppFolders } from '../src/lib/github-app-catalog.ts'

const execFileAsync = promisify(execFile)
export const SOURCE_ENDPOINT = 'repos/badger/badgerfactory/contents/app-descriptions.json?ref=main'
export const CATALOG_ENDPOINT = 'repos/badger/home/git/trees/main?recursive=1'
const OUTPUT_PATH = fileURLToPath(new URL('../src/data/app-descriptions.json', import.meta.url))

async function readGitHubJson(endpoint) {
  try {
    const { stdout } = await execFileAsync('gh', [
      'api', endpoint, '-H', 'Accept: application/vnd.github.raw+json',
    ], { encoding: 'utf8', timeout: 60_000, maxBuffer: 10 * 1024 * 1024 })
    return JSON.parse(stdout)
  } catch (error) {
    throw new Error(`Could not read ${endpoint}. Check gh authentication, repository access, and the source file.`, { cause: error })
  }
}

export function validateDescriptions(descriptions, catalog) {
  if (!descriptions || typeof descriptions !== 'object' || Array.isArray(descriptions)) {
    throw new Error('Descriptions must be a JSON object of app folder names and description strings.')
  }
  if (!catalog || catalog.truncated !== false || !Array.isArray(catalog.tree)
    || catalog.tree.some((entry) => !entry || typeof entry.path !== 'string' || typeof entry.type !== 'string')) {
    throw new Error('The app catalog must contain a complete, valid GitHub file tree.')
  }

  const folders = getInstallableAppFolders(catalog.tree).map(([name]) => name)
  if (!folders.length) throw new Error('The app catalog has no installable apps; the saved descriptions were not changed.')

  const invalid = Object.entries(descriptions).filter(([name, description]) =>
    !/^[a-z0-9][a-z0-9_-]*$/.test(name)
    || ['menu', 'startup', 'constructor', 'prototype'].includes(name)
    || typeof description !== 'string'
    || !description.trim()
    || description !== description.trim()
    || /[\u0000-\u001f\u007f]/.test(description)
  ).map(([name]) => name)
  if (invalid.length) throw new Error(`Invalid description entries: ${invalid.sort().join(', ')}.`)

  const missing = folders.filter((name) => !Object.hasOwn(descriptions, name))
  if (missing.length) throw new Error(`Missing descriptions for store apps: ${missing.sort().join(', ')}.`)

  return Object.fromEntries(Object.entries(descriptions).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0
  ))
}

export async function syncAppDescriptions({ outputPath = OUTPUT_PATH, readGitHub = readGitHubJson } = {}) {
  const [source, catalog] = await Promise.all([
    readGitHub(SOURCE_ENDPOINT),
    readGitHub(CATALOG_ENDPOINT),
  ])
  const descriptions = validateDescriptions(source, catalog)
  const contents = `${JSON.stringify(descriptions, null, 2)}\n`
  let previous
  try {
    previous = await readFile(outputPath, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (previous === contents) return { changed: false, count: Object.keys(descriptions).length }

  await mkdir(dirname(outputPath), { recursive: true })
  const temporaryPath = `${outputPath}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, contents, { flag: 'wx' })
    await rename(temporaryPath, outputPath)
  } finally {
    await rm(temporaryPath, { force: true })
  }
  return { changed: true, count: Object.keys(descriptions).length }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await syncAppDescriptions()
    console.log(`${result.changed ? 'Updated' : 'Unchanged'}: ${result.count} app descriptions in src/data/app-descriptions.json.`)
  } catch (error) {
    console.error(`App description update failed: ${error.message}`)
    process.exitCode = 1
  }
}
