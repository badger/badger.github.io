# screen.blit(image, rect) draws an image scaled into a destination rectangle.
# Setting image.alpha before each blit fades the copies in and out.

import random
import math

badge.mode(LORES | VSYNC)

skull = image.load("/system/assets/skull.png")

while True:
  random.seed(0)
  for i in range(30):
    s = (math.sin(badge.ticks / 500) * 1) + 2

    skull.alpha = int((math.sin((badge.ticks + i * 30) / 500) + 1) * 127)

    x = math.sin(i + badge.ticks / 1000) * 40
    y = math.cos(i + badge.ticks / 1000) * 40

    pos = vec2(x + rnd(-20, 180), y + rnd(-20, 140))

    dr = rect(
      pos.x, pos.y, 32 * s, 24 * s
    )
    screen.blit(skull, dr)
  badge.update()
