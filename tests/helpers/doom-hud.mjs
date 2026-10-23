export function decodeDoomHud(bytes) {
  const wad = Buffer.from(bytes)
  if (wad.length < 12 || !['IWAD', 'PWAD'].includes(wad.toString('ascii', 0, 4))) throw new Error('Invalid Doom WAD.')
  const count = wad.readUInt32LE(4)
  const directory = wad.readUInt32LE(8)
  if (directory + count * 16 > wad.length) throw new Error('Invalid WAD directory.')
  function lump(name) {
    for (let index = 0; index < count; index++) {
      const entry = directory + index * 16
      if (wad.toString('ascii', entry + 8, entry + 16).replace(/\0/g, '') !== name) continue
      const start = wad.readUInt32LE(entry)
      const end = start + wad.readUInt32LE(entry + 4)
      if (end > wad.length) throw new Error(`Invalid WAD lump: ${name}.`)
      return wad.subarray(start, end)
    }
    throw new Error(`WAD is missing ${name}.`)
  }
  const palette = lump('PLAYPAL')
  const patch = lump('STBAR')
  if (palette.length < 768 || patch.length < 8) throw new Error('Invalid WAD HUD.')
  const width = patch.readUInt16LE(0)
  const height = patch.readUInt16LE(2)
  if (!width || !height || width > 320 || height > 200 || patch.length < 8 + width * 4) throw new Error('Invalid WAD HUD dimensions.')
  const pixels = new Uint8Array(width * height * 4)
  for (let x = 0; x < width; x++) {
    let cursor = patch.readUInt32LE(8 + x * 4)
    for (;;) {
      if (cursor >= patch.length) throw new Error('Invalid WAD HUD column.')
      const top = patch[cursor++]
      if (top === 255) break
      const length = patch[cursor++]
      cursor++
      if (cursor + length + 1 > patch.length || top + length > height) throw new Error('Invalid WAD HUD post.')
      for (let y = 0; y < length; y++) {
        const color = patch[cursor + y] * 3
        pixels.set([...palette.subarray(color, color + 3), 255], ((top + y) * width + x) * 4)
      }
      cursor += length + 1
    }
  }
  return { width, height, pixels: [...pixels] }
}
