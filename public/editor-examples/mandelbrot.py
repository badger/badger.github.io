# A basic Mandelbrot set renderer with a 60-frame average FPS counter.
#
# Rendering a fractal pixel-by-pixel in Python is heavy work, so this renders
# into an off-screen image() at a quarter of the screen resolution and blits
# that up to fill the display. The FPS reading is averaged over the last 60
# frames to smooth out the per-frame jitter.

import time

badge.mode(LORES)

W, H = screen.width, screen.height
BW, BH = W // 4, H // 4    # low-res render buffer (quarter resolution per axis)
MAX_ITER = 32

# Off-screen buffer we render the fractal into, then scale up onto the screen.
# memoryview(buf) exposes its raw RGBA8888 pixel bytes (4 per pixel) so we can
# write straight into the buffer instead of going through buf.put().
buf = image(BW, BH)
pixels = memoryview(buf)


def hsv_to_rgb(h, s, v):
    i = int(h * 6) % 6
    f = h * 6 - int(h * 6)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    r, g, b = ((v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q))[i]
    return int(r * 255), int(g * 255), int(b * 255)


# Pre-build the (r, g, b) bytes per iteration count so we don't compute colours
# in the hot loop. The final entry is for points that never escape (the set).
palette = [hsv_to_rgb((i / MAX_ITER * 0.85 + 0.55) % 1.0, 0.9, 1.0) for i in range(MAX_ITER)]
palette.append((0, 0, 0))

# Slowly zoom into the "seahorse valley".
cx, cy = -0.743643887037, 0.131825904205
zoom = 3.0

# Rolling window of the last 60 frame durations (ms).
frame_times = []
last = time.ticks_ms()

while True:
    # -- Frame timing: keep a 60-sample rolling average --
    now = time.ticks_ms()
    frame_times.append(time.ticks_diff(now, last))
    last = now
    if len(frame_times) > 60:
        frame_times.pop(0)
    avg = sum(frame_times) / len(frame_times)
    fps = 1000.0 / avg if avg > 0 else 0.0

    # -- Map each pixel to a point on the complex plane --
    scale = zoom / BW
    x0 = cx - BW * 0.5 * scale
    y0 = cy - BH * 0.5 * scale

    off = 0
    for py in range(BH):
        ci = y0 + py * scale
        for px in range(BW):
            cr = x0 + px * scale
            zr = 0.0
            zi = 0.0
            i = 0
            # Iterate z = z^2 + c until it escapes the radius-2 circle.
            while i < MAX_ITER:
                zr2 = zr * zr
                zi2 = zi * zi
                if zr2 + zi2 > 4.0:
                    break
                zi = 2.0 * zr * zi + ci
                zr = zr2 - zi2 + cr
                i += 1
            # Write the pixel's RGBA bytes straight into the buffer.
            r, g, b = palette[i]
            pixels[off] = r
            pixels[off + 1] = g
            pixels[off + 2] = b
            pixels[off + 3] = 255
            off += 4

    # Scale the low-res buffer up to fill the screen.
    screen.blit(buf, rect(0, 0, W, H))

    # -- FPS overlay --
    screen.pen = color.black
    screen.rectangle(0, 0, 58, 12)
    screen.pen = color.white
    screen.text("{:.1f} fps".format(fps), 2, 2)

    # Zoom in, resetting before float precision breaks down.
    zoom *= 0.985
    if zoom < 0.0009:
        zoom = 3.0

    badge.update()
