# Draw a sprite through an arbitrary mat3 by filling its rectangle with
# brush.image - letting you rotate and scale about any pivot, which plain blit
# can't do.

import math

badge.mode(LORES | VSYNC)

skull = image.load("/system/assets/skull.png")

def magic_sprite(src, pos, scale=1, angle=0):
  w, h = src.width, src.height
  t = mat3().translate(*pos).scale(scale, scale).rotate(angle).translate(-w / 2, -h)
  # The rect carries the transform; the brush fills it 1:1 in the rect's own
  # space (identity), so the image isn't transformed a second time.
  screen.pen = brush.image(src, mat3())
  rect = shape.rectangle(0, 0, w, h)
  rect.transform = t
  screen.shape(rect)


while True:
  scale = (math.sin(badge.ticks / 1000) + 1.0) * 3 + 1
  angle = math.cos(badge.ticks / 500) * 100
  magic_sprite(skull, (80, 60), scale, angle)
  badge.update()
