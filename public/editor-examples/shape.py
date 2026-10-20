# shape.custom(outer, hole) builds a vector shape (here a square with a square
# hole) that you draw with screen.shape(). Its .transform is a mat3 you can
# translate / scale / rotate - set it per draw to stamp the shape many times.

import math

badge.mode(LORES | VSYNC)

while True:
  screen.antialias = image.X4
  screen.pen = color.rgb(0, 255, 255, 50)
  s = shape.custom([vec2(10, 10), vec2(20, 10), vec2(20, 20), vec2(10, 20)], [vec2(15, 15), vec2(25, 15), vec2(25, 25), vec2(15, 25)])

  for i in range(36):
    size = math.sin(badge.ticks / 500 + i) * 3
    angle = badge.ticks / 50 + i * 18
    s.transform = mat3().translate(80, 60).scale(size).rotate(angle)
    screen.shape(s)
  badge.update()
