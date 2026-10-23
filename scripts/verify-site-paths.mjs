import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const base = `${(process.argv[2] || '/').replace(/\/$/, '')}/`
assert.ok(base.startsWith('/') && !base.startsWith('//'), 'Expected a site base path')
const origin = process.argv[3] && new URL(process.argv[3]).origin
const directory = resolve('dist')
const pages = (await readdir(directory, { recursive: true })).filter(path => path.endsWith('.html'))
assert.ok(pages.length > 0, 'Build the site before checking its URLs')

for (const page of pages) {
  const html = await readFile(resolve(directory, page), 'utf8')
  for (const [, attribute, value] of html.matchAll(/\b(href|src|srcset|component-url|renderer-url)="([^"]*)"/g)) {
    if (!value.startsWith('/') || value.startsWith('//')) continue
    assert.ok(value.startsWith(base), `${page}: ${attribute}="${value}" escapes ${base}`)
    if (/\.(css|js)(?:[?#]|$)/.test(value)) {
      const pathname = new URL(value, 'https://example.invalid').pathname
      await access(resolve(directory, decodeURIComponent(pathname.slice(base.length))))
    }
  }
  for (const [, value] of html.matchAll(/<meta property="og:image" content="([^"]*)"/g)) {
    const image = new URL(value)
    if (origin) assert.equal(image.origin, origin, `${page}: og:image has the wrong deployment origin`)
    assert.ok(image.pathname.startsWith(base), `${page}: og:image escapes ${base}`)
    await access(resolve(directory, decodeURIComponent(image.pathname.slice(base.length))))
  }
}

console.log(`Verified ${pages.length} pages: local URLs stay under ${base}, CSS, JavaScript and sharing images exist`)
