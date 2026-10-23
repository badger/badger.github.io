# Doom browser assets

The secret `/virtual` route ships the original, unmodified **Doom 1 v1.9
shareware** episode and a pinned GPL-licensed WebAssembly engine. The WAD is
shareware, not freeware, public domain, or GPL content.

## Bundled game data

`public/doom/DOOM1.WAD` is the canonical shareware IWAD:

- Size: `4,196,020` bytes
- SHA-256: `1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771`
- SHA-1: `5b2e249b9c5133ec987b3ea77596381dc0d6bc1d`
- Historical MD5: `f0cefca49926d00903cf57551d901abe`

The original limited-use shareware license is retained at
`licenses/DOOM1-SHAREWARE.txt`. It permits making free copies of the unmodified
software and prohibits charging consideration for receipt or use. This site
does not include commercial `DOOM.WAD` or `DOOM2.WAD` data.

## Bundled engine

The browser runtime uses the GPLv2 WebSockets Doom port derived from Chocolate
Doom:

- Browser distribution:
  `danborden1/doom-web@e0ba81004e27e7d66141925dfebb091a558e2fe8`
- Published engine deployment:
  `Saketh-Chandra/doom-wasm-pwa@5b1e1fe7385b6f0b19d60dece6adbf88f6842e20`
- Corresponding source:
  `Saketh-Chandra/doom-wasm-pwa@a77edfd8bbc7e66b119a49c954f69a8b24e59206`

`runtime/doom.mjs` embeds the reviewed Emscripten loader and adds the local
adapter required by the badge texture/input APIs. `runtime/doom.wasm` is rebuilt
with Emscripten 3.1.45 and `runtime/OPL-WEBAUDIO.patch` to let the built-in OPL
music synthesizer initialize without blocking WebAudio. Music starts after the
first user input and pauses with the game, including while YouTube is open.
The GPLv2 text is retained in
`runtime/COPYING.txt`; exact source and rebuild information is in
`runtime/SOURCE.md`.

## Verification

CI and deployment fail unless every committed artifact matches
`config/doom-runtime-approved.json`:

```sh
npm run verify:doom-assets -- --require
```

The browser also verifies the WAD, adapter, and WebAssembly SHA-256 values
before executing them.

The Rotate control keeps the framebuffer upright and remaps only controls
embedded in the rotated 3D badge. Keyboard arrow keys always retain viewer-relative movement.

## Rebuilding the adapter

Rebuild the patched engine using `runtime/SOURCE.md`, obtain the pinned original
configuration and unmodified shareware WAD, then run:

```sh
npm run build:doom-runtime -- \
  /path/to/websockets-doom.js \
  /path/to/websockets-doom.wasm \
  /path/to/default.cfg \
  /path/to/COPYING.txt \
  /path/to/DOOM1.WAD \
  /path/to/DOOM1-SHAREWARE.txt
```

The build script verifies pinned input hashes before replacing any public
runtime files or approval metadata.

## Attribution

DOOM shareware © id Software. DOOM and associated trademarks belong to their
respective owners. This unofficial browser integration is not affiliated with
or endorsed by id Software, Bethesda Softworks, or Microsoft.
