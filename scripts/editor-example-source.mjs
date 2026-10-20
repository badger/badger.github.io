import { fileURLToPath } from 'node:url'
import { isAbsolute, relative, sep } from 'node:path'

export const simulatorRevision = 'eb3b3fbf27e6e61635aef5de11ab17e6303e8c20'

const GLYPH_REGISTRATION = [
  '  "circle": circle_glyph_renderer\n}\n',
  '  "circle": circle_glyph_renderer\n}\n\nfor glyph_name, renderer in glyph_renderers.items():\n  add_glyph(glyph_name, renderer)\n',
]

// Upstream text examples use text.tokenise()/text.draw() and rom_font, which the
// shipping badge firmware does not have. Rewrite them to screen.text() + add_glyph().
const EXAMPLE_REPLACEMENTS = {
  'raycast.py': [
    ['minimap_overlay_len = minimap_overlay.width * minimap_overlay.height\n', 'minimap_overlay_len = len(minimap_overlay_mv)\n'],
  ],
  'text.py': [
    ['# text.tokenise() + text.draw() lay out word-wrapped rich text inside a rect.\n# [tags] in the string call your glyph_renderers - here to change pen colour\n', '# screen.text() lays out word-wrapped rich text inside a rect. [tags] in the\n# string call glyph renderers registered with add_glyph() - here to change pen colour\n'],
    ['screen.font = rom_font.compass\n', 'screen.font = font.compass\n'],
    ['nope = rom_font.nope\n', 'nope = font.nope\n'],
    GLYPH_REGISTRATION,
    ['  tokens = text.tokenise(screen, message, glyph_renderers)\n', ''],
    ['text.draw(screen, tokens, bounds, line_spacing=1, word_spacing=1.05)', 'screen.text(message, bounds, line_height=1, word_spacing=1.05)'],
  ],
  'vector_text.py': [
    GLYPH_REGISTRATION,
    ['  tokens = text.tokenise(screen, message, size=size, glyph_renderers=glyph_renderers)\n', ''],
    ['text.draw(screen, tokens, bounds, line_spacing=1, word_spacing=1.05, size=size)', 'screen.text(message, bounds, font_size=size, line_height=1, word_spacing=1.05)'],
  ],
}

export function adaptExampleSource(file, source) {
  let adapted = source.replace(/\r\n/g, '\n')
  for (const [from, to] of EXAMPLE_REPLACEMENTS[file] ?? []) {
    if (!adapted.includes(from)) throw new Error(`${file} changed upstream; update its adaptation in editor-example-source.mjs`)
    adapted = adapted.replace(from, to)
  }
  return adapted
}

export function exampleAssetDestination(asset, staging) {
  const decoded = decodeURIComponent(asset)
  if (!decoded.startsWith('assets/') || /[\\\x00-\x1f?#]/.test(decoded) || decoded.split('/').some(part => !part || part === '..' || part === '.')) throw new Error('Unsafe asset path')
  const destination = new URL(asset, staging)
  const path = relative(fileURLToPath(staging), fileURLToPath(destination))
  if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) throw new Error('Unsafe asset path')
  return destination
}
