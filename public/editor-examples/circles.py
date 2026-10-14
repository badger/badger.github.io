# Hundreds of circles laid down each frame with screen.circle(point, radius).
# rnd() is a quick random helper (rnd(n) -> 0..n, rnd(a, b) -> a..b) and vec2
# packs an x, y position; badge.ticks drives the drift.

import math
import random

badge.mode(LORES | VSYNC)

while True:
  random.seed(0)

  for i in range(100):
    x = math.sin(i + badge.ticks / 100) * 40
    y = math.cos(i + badge.ticks / 100) * 40

    p = vec2(x + rnd(160), y + rnd(120))
    r = rnd(5, 20)
    screen.pen = color.rgb(rnd(255), rnd(255), rnd(255))
    screen.circle(p, r)
  badge.update()
