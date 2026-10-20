# screen.triangle(p1, p2, p3) fills a triangle from three vec2 points - a field
# of random ones jittering around drifting centres.

import math
import random

badge.mode(LORES | VSYNC)

while True:
  random.seed(0)
  for i in range(50):
    x = math.sin(i + badge.ticks / 100) * 40
    y = math.cos(i + badge.ticks / 100) * 40

    p = vec2(x + rnd(160), y + rnd(120))
    p1 = vec2(p.x + rnd(-30, 30), p.y + rnd(-30, 30))
    p2 = vec2(p.x + rnd(-30, 30), p.y + rnd(-30, 30))
    p3 = vec2(p.x + rnd(-30, 30), p.y + rnd(-30, 30))

    screen.pen = color.rgb(rnd(255), rnd(255), rnd(255))
    screen.triangle(p1, p2, p3)
  badge.update()
