---
name: badge-screenshots
description: Capture pixel-exact screenshots from a 2026 Badger badge attached over USB, for hacks, app pages, and docs. Use when you need images of badge apps, the home screen menu, or the result of a hack running on real hardware.
---

# Capture screenshots from an attached badge

Screenshots come straight from the badge's framebuffer over the USB serial REPL, so they show exactly what the screen shows with no camera glare.

## Requirements

- A badge running MonaOS 4.0, connected with a USB-C data cable
- `mpremote` (`pip install mpremote` or `brew install mpremote`) and Python with Pillow
- The badge on its normal screen, not in USB Disk Mode or firmware mode

Find the port with `mpremote devs`. The badge shows as `2e8a:1101` (`/dev/cu.usbmodem*` on a Mac, `/dev/ttyACM*` on Linux, `COMx` on Windows). `scripts/capture.py` finds it automatically.

## Capture

```bash
cd .github/skills/badge-screenshots/scripts
python3 capture.py /system/apps/menu ../../../../public/images/hacks/<topic> menu
```

For navigation, call `capture()` with steps:

```python
from capture import capture
capture("/system/apps/menu", [
    (150, None, "menu"),            # wait for the opening animation, then shoot
    (1, "BUTTON_RIGHT", None),      # press right on the next frame
    (80, None, "menu-next"),        # let the label settle, then shoot
    (1, "BUTTON_SELECT", None),
    (60, None, "opened"),
], "public/images/hacks/<topic>")
```

Each step is `(wait_frames, button, shot_name)`. Button names are MicroPython constants such as `BUTTON_UP`, `BUTTON_SELECT`, `BUTTON_BACK`, `BUTTON_MENU`, and `BUTTON_HOME`. If an app's `update()` returns another app path, the harness launches it and continues.

Output is 640×480 PNG. Low-res 160×120 and hi-res 320×240 frames are both scaled up with nearest neighbour, so pixels stay crisp.

Save images under `public/images/hacks/<topic>/` (or the matching content folder) and view each one before using it.

## How it works

- `capture.py` prepends `APP` and `STEPS` to `harness.py` and runs it with `mpremote run`. Nothing is written to the badge.
- `harness.py` replaces `builtins.run` with its own frame loop, which:
  - calls `badge.poll()`;
  - clears with `badge.default_clear` and sets `badge.default_pen`, as the real runner does (without this, labels overprint);
  - calls `update()`, then `badgeware.display.update()`.
- Presses are injected by replacing `badge.pressed`, `badge.held`, and `badge.released`.
- On a shot frame it prints `screen.raw` as base64 between `@@SHOT name w h` and `@@END`. `capture.py` decodes it as little-endian RGB565.

## Timing tips

- Menu: wait about 150 frames for the opening animation and about 80 after moving so the ribbon label settles.
- Apps with intro screens or Wi-Fi need more frames. Take a test shot and adjust.
- The 3D Mona head overlaps the bottom-right of the menu. That's how the real screen looks.

## Stage files on the badge

`/system` is read-only from the REPL. To add photos, apps, or edited files for a screenshot:

1. Back up every file you will change or add next to, for example to `/tmp/badge-backup/`.
2. Run `mpremote connect <port> run scripts/msc.py`. The badge restarts into USB Disk Mode, so the "Device not configured" error from mpremote is expected.
3. Wait for the **BADGER** drive to mount (`/Volumes/BADGER` on a Mac). Its root is the badge's `/system`.
4. Copy files, run `sync`, then eject with `diskutil eject /Volumes/BADGER`. On a Mac, delete any `._*` files Finder created.
5. The badge restarts. Wait about 15 seconds before capturing.

When you're done, repeat these steps to remove test files and restore the backups. Capture the stock screen to confirm, for example the menu counter should read `01 / 21` on stock MonaOS 4.0.

## When you need the user

Some steps need hands on the badge: firmware mode (hold **HOME / BOOT**, press **RESET**, release **HOME / BOOT**), touch input you can't inject, or photos of the hardware. Get the user's attention with `say "..."` on a Mac, then ask with the ask_user tool.

Never flash firmware or erase the badge without the user's approval.
