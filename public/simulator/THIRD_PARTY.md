# Bundled runtime notices

The simulator front end is adapted from [badgeware-web-simulator](https://github.com/pimoroni/badgeware-web-simulator/tree/eb3b3fbf27e6e61635aef5de11ab17e6303e8c20). Its MIT notice remains in `LICENSE`, alongside the MicroPython MIT notice. The categorized Python examples and their required assets are bundled from the same revision in `../editor-examples/`, with a separate copy of the upstream MIT notice. The documents in `licenses/` ship with the static site and cover the compiled dependencies below.

The shared `world.geo.json` asset comes from [the Tufty firmware assets at ee84772fb7](https://github.com/pimoroni/tufty2350/blob/ee84772fb7f7d5424e9593029caba815c6f89c80/firmware/assets/world.geo.json), under the firmware repository's MIT license. The simulator compatibility helpers are implemented locally; they do not replace badge firmware or get included in app uploads.

The additional ROM fonts were extracted from the user-supplied `badger-d71d98d-with-filesystem.uf2` (SHA-256 `3fc99270c702524533b5528cfde208e6e0c263e012715f1f1ee07ed6a3adb6b8`), the firmware image shipped on Universe 2026 badges. The fourteen icon font files match [Gadgetoid/iconfont-ppf at 8612a32402](https://github.com/Gadgetoid/iconfont-ppf/tree/8612a32402ec16f8f6550261446f78317936e7a7/dist) byte for byte. Its [README](https://github.com/Gadgetoid/iconfont-ppf/blob/8612a32402ec16f8f6550261446f78317936e7a7/README.md) attributes the sprites to nikoichu’s 1-bit Pixel Icons; its CC0 notice is retained in `licenses/iconfont-ppf.txt`. The supplied image also provides `badgeware.ppf` and `badgewaremax.ppf`. The firmware binary is not bundled.

Shared `/system/assets` files from the same image's writable filesystem are bundled when they match public MIT-licensed firmware sources byte for byte: `skull.png` and `icons.png` from [badger2350 at 7f2fa36732](https://github.com/pimoroni/badger2350/tree/7f2fa36732eb8160ec91c8499afbb0935dff63ec/firmware/assets), and `cards.png`, `squirrel.gif`, `tufty.png` and `squirrel-sprites/` from [tufty2350 at ee84772fb7](https://github.com/pimoroni/tufty2350/tree/ee84772fb7f7d5424e9593029caba815c6f89c80/firmware/assets). The Lato fonts `fonts/lato-400.af` and `fonts/lato-900.af` ship with their SIL Open Font License in `fonts/licences/OFL.txt`, as on the badge. `background.png` and `sparkle/invertocat.png` are GitHub artwork copied from the same image. The image's `armmark.svg` is an Arm trademark and is not bundled. Apps, `main.py`, `startup/` and `secrets.py` from the image are not bundled.

| Component | Notice | Source checked |
| --- | --- | --- |
| MicroPython | `licenses/MicroPython.txt` | [4559a9a5a4](https://github.com/pimoroni/micropython/tree/4559a9a5a433f75ada6a01933c19878fd3a7dd81), the revision embedded in both WASM binaries |
| Frozen micropython-lib modules | `licenses/micropython-lib.txt` | [ee4bb8ff13](https://github.com/micropython/micropython-lib/tree/ee4bb8ff139e24c42b739935fbd8ec7c4d061e02), including MIT and Python license terms |
| Emscripten JavaScript and runtime | `licenses/emscripten.txt` | [Emscripten LICENSE](https://github.com/emscripten-core/emscripten/blob/main/LICENSE), including its Mozilla and Node.js portions |
| musl C library | `licenses/musl.txt` | [musl COPYRIGHT](https://github.com/emscripten-core/emscripten/blob/main/system/lib/libc/musl/COPYRIGHT), including contributor and math-library notices |
| LLVM compiler runtime and C++ standard libraries | `licenses/llvm-compiler-rt.txt`, `licenses/llvm-libcxx.txt`, `licenses/llvm-libcxxabi.txt` | LLVM Apache 2.0 with exceptions and legacy MIT/NCSA terms |
| PNGdec and JPEGDEC | `licenses/pngdec.txt`, `licenses/jpegdec.txt` | BitBank Software Apache 2.0 notices in PicoVector |
| PNGdec's zlib | `licenses/zlib.txt` | zlib 1.2.11 notice from the vendored `zlib.h` |
| MicroPython uzlib | `licenses/uzlib.txt` | Inflate and checksum notices for Joergen Ibsen, Paul Sokolovsky, Jim Mussared, Jean-loup Gailly and Mark Adler |
| MicroPython re1.5 | `licenses/re1.5.txt` | Russ Cox/Google BSD terms and Paul Sokolovsky adaptation notice |
| MicroPython SHA-256 | `licenses/sha256.txt` | Brad Conte public-domain attribution and disclaimer |
| QR Code generator | `licenses/qrcodegen.txt` | Project Nayuki MIT notice in PicoVector |

The dependency audit follows [badgeware-wasm 8cc5b05a1a](https://github.com/pimoroni/badgeware-wasm/tree/8cc5b05a1a07a823eb68ca1952b3603fe4d769bf), its `tools/build.sh`, `simulator/manifest_common.py`, feature configuration, and `picovector_wasm.cmake`. That build points to [picovector-micropython 1338077eaa](https://github.com/pimoroni/picovector-micropython/tree/1338077eaaab2ca60bc91653f79f48996b34e469) and [PicoVector 5aad22c044](https://github.com/pimoroni/picovector/tree/5aad22c0441651f8f769a5ccd104fd0112b04cd6). Its source lists link PNGdec, JPEGDEC, zlib and qrcodegen. The portable WASM build disables the RP2 hardware interpolator and does not link the Pico SDK hardware libraries.

The upstream front end does not provide a complete toolchain or dependency lock manifest for these artifacts. Build dependency revisions above are the inspected upstream pointers, rather than a claim that every linked object can be recovered from the binaries. Emscripten, musl and LLVM notice documents were retrieved from their official source repositories on 2026-10-11. Keep their full notices when replacing the runtime and repeat the dependency audit when updating the artifacts.

Artifact SHA-256 values:

```text
c1664165cabcbcb5aca5ac0e72ca8aace383ec30c455d526325563921f6c9e74  asyncify/micropython.mjs
34660284e9edb22c4c682e87afe52cc700bd8b65595e872e83d669721c237522  asyncify/micropython.wasm
dfebdf53540f5cfbeac85a4ae0784d0054218d11e6cf7b4483a355b115ab6e23  jspi/micropython.mjs
a6f8ea74c9003f3d485ff536856e7c0a1337fe6464a8d7f952118a88da43918e  jspi/micropython.wasm
```

## Editor 3D badge model

`models/github-mona-badge.glb` is the 2026 badge model downloaded from [Lee Reilly’s H4X0R3D badge showcase](https://leereilly.net/h4x0r3d-badge/#hardware), at `models/github_mona_badge_screen_centered.glb`, on 2026-10-12. Its embedded generator is `https://github.com/mikedh/trimesh`. The source is linked from the viewer. The model endpoint does not include license metadata; no new license is asserted for the model or its GitHub artwork.

Source SHA-256: `a7cf8a12cb2d014092c7c2a9079f7f3eb126963a06aee2e95462a5e33d88636d`.

`scripts/build-badge-model.mjs` modifies the source model:

- Replaces the lower clear shell with geometry tessellated from the Badgeware case CAD (`badgeware_solid.step`), with the PCB slot tab removed. The case is scaled to the model's PCB width.
- Moves the five button caps and collars onto the case's button nubs.
- Removes the approximate USB-C housing and socket that protruded between the up and down buttons.
- Mirrors the rear artwork UVs so the rear print reads correctly.

The upper board, its artwork, and the remaining parts are unchanged. The editor replaces the display material with its live simulator output. Rebuild with `npm run build:badge-model -- <badgeware_solid.step> [source.glb]`. The STEP file is not committed.

Output SHA-256: `12519bdbdcb71a00b4c76483bcb467b5bf3a7a91db51f7faf5a4e7a433c106c2`.

Three.js is bundled under its MIT license, retained in `licenses/three.txt`.
