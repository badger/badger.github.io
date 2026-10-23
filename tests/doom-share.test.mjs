import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { build } from 'esbuild'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/doom-share.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { shareURL, socialURL, randomShareText, mastodonOrigin, withUniverseUsername } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
)

test('Universe attribution follows the avatar while preserving the campaign and ignoring other destinations', () => {
  const base = 'https://githubuniverse.com/?utm_source=GitHub&utm_medium=Site&utm_campaign=virtual_badge_uni_26'
  assert.equal(withUniverseUsername(base, 'LeeReilly'), `${base}&utm_content=leereilly`)
  assert.equal(withUniverseUsername(`${base}&utm_content=previous`, ''), base)
  assert.equal(withUniverseUsername(base, '../user'), base)
  assert.equal(withUniverseUsername('https://github.com/id-Software/DOOM', 'octocat'), 'https://github.com/id-Software/DOOM')
})
test('share links preserve only the avatar, deployment subpath and platform attribution', () => {
  const url = shareURL('https://badger.github.io/virtual/?u=LeeReilly&capture=1&utm_source=old#x', 'bluesky')
  assert.equal(url, 'https://badger.github.io/virtual?u=leereilly&utm_source=bluesky&utm_medium=social&utm_campaign=d00m3d')
  assert.equal(shareURL('https://example.github.io/badger.github.io/virtual/?u=octocat'), 'https://example.github.io/badger.github.io/virtual?u=octocat')
  assert.equal(shareURL('https://badger.github.io/virtual/?u=../x'), 'https://badger.github.io/virtual/')
})

test('each social composer embeds a correctly attributed URL without double encoding', () => {
  for (const platform of ['x', 'linkedin', 'threads', 'facebook', 'bluesky']) {
    const composer = new URL(socialURL(platform, 'https://badger.github.io/virtual/?u=octocat'))
    const payload = [...composer.searchParams.values()].join(' ')
    assert.ok(payload.includes('u=octocat'))
    assert.ok(payload.includes(`utm_source=${platform}`))
    assert.equal(composer.protocol, 'https:')
  }
})

test('share text randomly selects each approved message and retains the attributed link', t => {
  const messages = [
    "That's me. On a #GitHubUniverse badge. Playing DOOM.",
    'My face. My badge. DOOM. #GitHubUniverse',
    "I've been immortalized on a badge that runs DOOM. #GitHubUniverse",
    "Look, Mom! I'm on a badge that runs DOOM. #GitHubUniverse",
    "That's my avatar. That's DOOM. That's #GitHubUniverse.",
    'Finally, a conference badge with my face AND DOOM. #GitHubUniverse',
  ]
  const random = t.mock.method(Math, 'random')
  for (const [index, message] of messages.entries()) {
    random.mock.mockImplementation(() => (index + 0.5) / messages.length)
    assert.equal(randomShareText(), message)
    for (const platform of ['x', 'threads', 'bluesky', 'mastodon']) {
      const href = 'https://badger.github.io/virtual/?u=octocat'
      const composer = new URL(socialURL(platform, href))
      assert.equal(composer.searchParams.get('text'), platform === 'x' ? message : `${message} ${shareURL(href, platform)}`)
      if (platform === 'x') assert.equal(composer.searchParams.get('url'), shareURL(href, platform))
    }
  }
})

test('Mastodon accepts a server hostname but rejects credentials, paths and unsafe schemes', () => {
  assert.equal(mastodonOrigin('mastodon.social'), 'https://mastodon.social')
  assert.equal(mastodonOrigin('https://fosstodon.org/'), 'https://fosstodon.org')
  for (const host of ['', 'http://mastodon.social', 'javascript:alert(1)', 'https://user:pass@host.social', 'https://host.social/path', 'host.social?x=1', 'localhost']) {
    assert.throws(() => mastodonOrigin(host), /server/)
  }
  const composer = new URL(socialURL('mastodon', 'https://badger.github.io/virtual/', 'mastodon.social'))
  assert.equal(composer.origin, 'https://mastodon.social')
  assert.ok(composer.searchParams.get('text').includes('utm_source=mastodon'))
})
