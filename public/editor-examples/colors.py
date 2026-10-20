# Three ways to build a spread of colour - and why they look so different.
#
#   color.hsv(h, s, v)        h, s, v   0-255 (h runs once around the hue wheel)
#   color.oklch(L, C, h, a)   L, C, a   0-255, hue in degrees (perceptually even)
#   color.rgb(r, g, b)        channels  0-255
#
# Watch the *brightness* along each bar. HSV sweeps hue evenly but its yellow
# glares while its blue sinks - equal v, very unequal perceived lightness. OKLCH
# sweeps the same hues but holds a flat perceived lightness (L and C fixed). And
# a straight RGB channel blend between two vivid colours slumps through a muddy
# grey middle, because RGB isn't a perceptual space at all.

badge.mode(HIRES)

X, W, STEP = 12, 296, 2   # bar left edge, width, column step

def bar(y, h, label, fn):
    for i in range(0, W, STEP):
        screen.pen = fn(i / W)
        screen.rectangle(X + i, y, STEP, h)
    screen.pen = color.white
    screen.text(label, X, y - 14)

while True:
    # HSV - even hue steps, lurching perceived brightness.
    bar(34, 46, "HSV    hue sweep, s = v = max",
        lambda t: color.hsv(t * 255, 255, 255))

    # OKLCH - even hue steps AND even perceived lightness (L, C held constant).
    bar(112, 46, "OKLCH  hue sweep, L / C fixed",
        lambda t: color.oklch(170, 110, t * 360, 255))

    # RGB - a linear channel blend lime -> magenta passes through grey.
    bar(190, 46, "RGB    blend lime -> magenta",
        lambda t: color.rgb(int(t * 255), int((1 - t) * 255), int(t * 255)))

    badge.update()
