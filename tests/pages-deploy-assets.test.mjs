import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const workflow = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')
const step = workflow.match(/      - name: Preserve assets for cached pages\n[\s\S]*?        run: \|\n((?:          .*\n)+)/)[1].replace(/^ {10}/gm, '')

async function runStep(t, runs, listFailure = false) {
  const directory = await mkdtemp(join(tmpdir(), 'badger-deploy-assets-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, 'dist'), { recursive: true })
  await mkdir(join(directory, 'scripts'))
  await mkdir(join(directory, 'previous/chunks'), { recursive: true })
  await writeFile(join(directory, 'dist/entry.current.js'), 'current')
  await writeFile(join(directory, 'previous/entry.previous.js'), 'import "./chunks/chunk.previous.js"')
  await writeFile(join(directory, 'previous/chunks/chunk.previous.js'), 'previous chunk')
  await copyFile(new URL('../scripts/preserve-page-assets.mjs', import.meta.url), join(directory, 'scripts/preserve-page-assets.mjs'))
  const archive = join(directory, 'previous.tar')
  const tar = spawnSync('tar', ['-cf', archive, '-C', join(directory, 'previous'), '.'], { encoding: 'utf8' })
  assert.equal(tar.status, 0, tar.stderr)
  const mock = `
gh() {
  if [[ "$1 $2" == "run list" ]]; then
    if [[ "$TEST_LIST_FAILURE" == "true" ]]; then return 1; fi
    printf '%s' "$TEST_RUNS"
    return 0
  fi
  case "$3" in
    101) echo 'artifact expired' >&2; return 1 ;;
    102) echo 'no artifact found' >&2; return 1 ;;
    103) cp "$TEST_ARCHIVE" "$7/artifact.tar" ;;
    104) printf 'invalid archive' > "$7/artifact.tar" ;;
    *) return 2 ;;
  esac
}
node() { command "$TEST_NODE" "$@"; }
`
  const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', mock + step], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, TEST_RUNS: runs.join('\n'), TEST_LIST_FAILURE: String(listFailure), TEST_ARCHIVE: archive, TEST_NODE: process.execPath },
  })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(await readFile(join(directory, 'dist/entry.current.js'), 'utf8'), 'current')
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'dist/page-assets.json'), 'utf8')), ['entry.current.js'])
  return { directory, output: result.stdout }
}

test('expired and missing historical artifacts do not block the current deployment', async t => {
  const { directory, output } = await runStep(t, ['101', '102'])
  assert.equal(output.match(/::warning::/g)?.length, 2)
  await assert.rejects(readFile(join(directory, 'dist/entry.previous.js')), { code: 'ENOENT' })
})

test('available historical scripts and their chunks survive another artifact expiring', async t => {
  const { directory, output } = await runStep(t, ['101', '103'])
  assert.match(output, /::warning::.*101/)
  assert.equal(await readFile(join(directory, 'dist/entry.previous.js'), 'utf8'), 'import "./chunks/chunk.previous.js"')
  assert.equal(await readFile(join(directory, 'dist/chunks/chunk.previous.js'), 'utf8'), 'previous chunk')
})

test('invalid historical archives do not block the current deployment', async t => {
  const { output } = await runStep(t, ['104'])
  assert.match(output, /::warning::.*could not be extracted/)
})

test('deployments proceed when previous runs cannot be listed', async t => {
  const { output } = await runStep(t, [], true)
  assert.match(output, /::warning::Could not list previous deployments/)
})

test('the first deployment needs no historical artifacts', async t => {
  const { output } = await runStep(t, [])
  assert.equal(output, '')
})

test('Pages artifacts have an explicit thirty-day retention policy', () => {
  const upload = workflow.match(/      - name: Upload artifact\n[\s\S]*?(?=\n  deploy:)/)[0]
  assert.match(upload, /retention-days: 30/)
})
