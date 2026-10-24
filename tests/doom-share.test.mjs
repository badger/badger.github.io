import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { build } from 'esbuild'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/doom-share.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'node', write: false,
})
const { initDoomShare, shareURL, socialURL, randomShareText, mastodonOrigin, withUniverseUsername } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
)

test('sharing controls survive cached navigation and clean up on a final departure', async t => {
  class Element extends EventTarget {
    hidden = false
    style = {}
    dataset = {}
    value = 'mastodon.social'
    focus() {}
    setAttribute(name, value) { this[name] = value }
    setCustomValidity() {}
    getBoundingClientRect() { return { left: 20, top: 20, bottom: 40, width: 40 } }
  }
  const selectors = ['copy', 'native', 'status', 'mastodon-form', 'open', 'menu', 'mastodon']
  const elements = Object.fromEntries(selectors.map(key => [`[data-share-${key}]`, new Element()]))
  const server = new Element()
  const mastodon = elements['[data-share-mastodon-form]']
  const menu = elements['[data-share-menu]']
  const trigger = elements['[data-share-open]']
  mastodon.querySelector = () => server
  menu.querySelector = () => new Element()
  const root = { querySelector: selector => elements[selector], querySelectorAll: () => [] }
  const document = Object.assign(new EventTarget(), { querySelectorAll: () => [] })
  const opened = []
  const copied = []
  const window = Object.assign(new EventTarget(), {
    innerWidth: 1000, innerHeight: 800,
    matchMedia: () => Object.assign(new EventTarget(), { matches: false }),
    open: (...args) => opened.push(args),
  })
  const globals = {
    window, document, location: new URL('https://badger.github.io/virtual?u=octocat'),
    navigator: { clipboard: { async writeText(text) { copied.push(text) } } },
  }
  const previous = new Map()
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  const dispose = initDoomShare(root)
  t.after(() => {
    dispose()
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: true }))
  window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }))
  trigger.dispatchEvent(new Event('click'))
  assert.equal(menu.hidden, false)
  assert.equal(trigger['aria-expanded'], 'true')
  elements['[data-share-copy]'].dispatchEvent(new Event('click'))
  await Promise.resolve()
  assert.deepEqual(copied, ['https://badger.github.io/virtual?u=octocat'])
  assert.equal(elements['[data-share-status]'].textContent, 'Link copied')
  elements['[data-share-mastodon]'].dispatchEvent(new Event('click'))
  assert.equal(mastodon.hidden, true)
  mastodon.dispatchEvent(new Event('submit', { cancelable: true }))
  assert.equal(opened.length, 1)
  assert.equal(new URL(opened[0][0]).origin, 'https://mastodon.social')
  window.dispatchEvent(Object.assign(new Event('pagehide'), { persisted: false }))
  trigger.dispatchEvent(new Event('click'))
  elements['[data-share-copy]'].dispatchEvent(new Event('click'))
  mastodon.dispatchEvent(new Event('submit'))
  await Promise.resolve()
  assert.equal(menu.hidden, false)
  assert.equal(copied.length, 1)
  assert.equal(opened.length, 1)
})

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
