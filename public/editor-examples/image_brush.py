# brush.image fills a shape with an image instead of a flat colour. The mat3
# passed to the brush rotates and scales the image within the shape.

import math

badge.mode(LORES | VSYNC)

skull = image.load("/system/assets/skull.png")

while True:
  t = mat3().translate(-12, -12).rotate(badge.ticks / 100).translate(80, 60).scale(math.sin(badge.ticks / 1000) * 4)
  imgbrush = brush.image(skull, t)

  screen.pen = imgbrush
  screen.shape(shape.circle(80, 60, 50))
  badge.update()
