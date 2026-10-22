"""Capture screenshots from an app running on an attached badge.

Usage from Python:
    from capture import capture
    capture("/system/apps/menu", [(150, None, "menu"), (1, "BUTTON_RIGHT", None), (80, None, "next")], "public/images/hacks/topic")

Each step is (wait_frames, button_constant_name_or_None, shot_name_or_None).
Button names are emitted unquoted, so use constants such as "BUTTON_SELECT".
"""
import binascii
import glob
import os
import subprocess
import sys
import tempfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))


def find_port():
    out = subprocess.run(["mpremote", "devs"], capture_output=True, text=True).stdout
    for line in out.splitlines():
        if "2e8a:" in line:
            return line.split()[0]
    ports = glob.glob("/dev/cu.usbmodem*") + glob.glob("/dev/ttyACM*")
    if ports:
        return ports[0]
    sys.exit("No badge found. Connect it with a data cable and check `mpremote devs`.")


def _decode(data, w, h):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            i = (y * w + x) * 2
            v = data[i] | (data[i + 1] << 8)  # RGB565, little-endian
            px[x, y] = (((v >> 11) & 31) * 255 // 31, ((v >> 5) & 63) * 255 // 63, (v & 31) * 255 // 31)
    return img.resize((640, 480), Image.NEAREST)


def capture(app, steps, outdir, port=None, pre=""):
    port = port or find_port()
    steps_src = "[" + ",".join(f"({w},{b},{n!r})" for w, b, n in steps) + "]"
    with open(os.path.join(HERE, "harness.py")) as f:
        src = pre + f"APP={app!r}\nSTEPS={steps_src}\n" + f.read()
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
        f.write(src)
        script = f.name
    try:
        out = subprocess.run(["mpremote", "connect", port, "run", script],
                             capture_output=True, text=True, timeout=300).stdout
    finally:
        os.unlink(script)
    lines = out.splitlines()
    names = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("@@SHOT"):
            _, name, w, h = line.split()
            data = b""
            i += 1
            while lines[i] != "@@END":
                data += binascii.a2b_base64(lines[i])
                i += 1
            os.makedirs(outdir, exist_ok=True)
            _decode(data, int(w), int(h)).save(os.path.join(outdir, name + ".png"), optimize=True)
            names.append(name)
        elif not line.startswith("@@"):
            print(line)
        i += 1
    print("saved", names)
    return names


if __name__ == "__main__":
    # python capture.py <app-path> <outdir> [name]  -> single shot after the opening animation
    app, outdir = sys.argv[1], sys.argv[2]
    name = sys.argv[3] if len(sys.argv) > 3 else os.path.basename(app.rstrip("/"))
    capture(app, [(150, None, name)], outdir)
