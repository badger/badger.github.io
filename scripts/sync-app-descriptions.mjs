import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getInstallableAppFolders } from '../src/lib/github-app-catalog.ts'

const HOME_REPOSITORY = 'badger/home'

export function catalogUrl(ref) {
  return `https://api.github.com/repos/${HOME_REPOSITORY}/git/trees/${ref}?recursive=1`
}

export function readmeUrl(ref, name, file) {
  return `https://raw.githubusercontent.com/${HOME_REPOSITORY}/${ref}/badge/apps/${name}/${file}`
}

export const APP_DESCRIPTIONS_PATH = fileURLToPath(new URL('../src/data/app-descriptions.json', import.meta.url))
const README_NAMES = ['README.md', 'readme.md']
const BLOCK_PREFIXES = ['#', '>', '|', '-', '!', '[!', '```', '<']

async function fetchText(url, { optional = false } = {}) {
  const headers = { 'User-Agent': 'badger-app-descriptions' }
  if (process.env.GITHUB_TOKEN && url.startsWith('https://api.github.com/')) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) })
  if (optional && response.status === 404) return null
  if (!response.ok) throw new Error(`Could not read ${url} (HTTP ${response.status}).`)
  return response.text()
}

async function readHomeCatalog(ref) {
  return JSON.parse(await fetchText(catalogUrl(ref)))
}

async function readHomeReadme(ref, name, file) {
  return fetchText(readmeUrl(ref, name, file), { optional: true })
}

// Mirrors badgerfactory scripts/update_app_descriptions.py.
export function firstSentence(readme) {
  const paragraph = []
  let fenced = false
  for (const line of readme.split(/\r?\n/)) {
    const text = line.trim()
    if (text.startsWith('```') || text.startsWith('~~~')) {
      if (paragraph.length && !fenced) break
      fenced = !fenced
      continue
    }
    if (fenced) continue
    const isBlock = BLOCK_PREFIXES.some((prefix) => text.startsWith(prefix))
      || /^(?:\*(?:\s|$)|(?:\*\s*){3,}$)/.test(text)
    if (!text || isBlock) {
      if (paragraph.length) break
      continue
    }
    paragraph.push(text)
  }
  const joined = paragraph.join(' ')
  return (joined.match(/^(.+?[.!?])(?=\s|$)/)?.[1] ?? joined).trim()
}
export const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/

export function describableFolders(tree) {
  return getInstallableAppFolders(tree).map(([name]) => name).filter((name) => KEY_PATTERN.test(name))
}

export function validateDescriptions(descriptions, catalog) {
  if (!descriptions || typeof descriptions !== 'object' || Array.isArray(descriptions)) {
    throw new Error('Descriptions must be a JSON object of app folder names and description strings.')
  }
  if (!catalog || catalog.truncated !== false || !Array.isArray(catalog.tree)
    || catalog.tree.some((entry) => !entry || typeof entry.path !== 'string' || typeof entry.type !== 'string')) {
    throw new Error('The app catalog must contain a complete, valid GitHub file tree.')
  }

  const installable = getInstallableAppFolders(catalog.tree)
  if (!installable.length) throw new Error('The app catalog has no installable apps; the saved descriptions were not changed.')
  const folders = describableFolders(catalog.tree)

  const invalid = Object.entries(descriptions).filter(([name, description]) =>
    !KEY_PATTERN.test(name)
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

export async function descriptionsForCatalog(catalog, {
  ref,
  existing = {},
  readReadme = readHomeReadme,
} = {}) {
  const source = { ...existing }
  const folders = Array.isArray(catalog?.tree) ? describableFolders(catalog.tree) : []
  for (const name of folders) {
    for (const file of README_NAMES) {
      const readme = await readReadme(ref, name, file)
      if (readme == null) continue
      const description = firstSentence(readme)
      if (description) source[name] = description
      break
    }
  }

  return validateDescriptions(source, catalog)
}

export async function writeJsonFile(outputPath, value) {
  const contents = `${JSON.stringify(value, null, 2)}\n`
  try {
    if (await readFile(outputPath, 'utf8') === contents) return false
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await mkdir(dirname(outputPath), { recursive: true })
  const temporaryPath = `${outputPath}.${randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, contents, { flag: 'wx' })
    await rename(temporaryPath, outputPath)
  } finally {
    await rm(temporaryPath, { force: true })
  }
  return true
}

export async function syncAppDescriptions({
  outputPath = APP_DESCRIPTIONS_PATH,
  ref = process.env.APPS_REF || 'main',
  readCatalog = readHomeCatalog,
  readReadme = readHomeReadme,
} = {}) {
  let existing = {}
  try {
    existing = JSON.parse(await readFile(outputPath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const catalog = await readCatalog(ref)
  const descriptions = await descriptionsForCatalog(catalog, { ref, existing, readReadme })
  return { changed: await writeJsonFile(outputPath, descriptions), count: Object.keys(descriptions).length }
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
