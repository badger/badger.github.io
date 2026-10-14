# The four corner case LEDs are controlled with badge.caselights(). Pass a
# single value for all of them, or four values (0.0-1.0) for each corner.

from math import sin, pi

badge.mode(HIRES)

labels = ["L-top", "L-bot", "R-top", "R-bot"]

while True:
    t = badge.ticks / 1000

    # A chase: each LED peaks at a different point in the cycle.
    levels = [max(0.0, sin(t * 3 - i * (pi / 2))) for i in range(4)]
    badge.caselights(*levels)

    # Mirror the LED levels on screen as four bars.
    for i, v in enumerate(levels):
        h = int(v * 120)
        screen.pen = color.rgb(int(v * 255), int(v * 200), int(v * 120))
        screen.rectangle(30 + i * 70, 190 - h, 50, h + 2)
        screen.pen = color.grey
        screen.text(labels[i], 30 + i * 70, 200)

    screen.pen = color.white
    screen.text("badge.caselights()", 10, 10)

    badge.update()
