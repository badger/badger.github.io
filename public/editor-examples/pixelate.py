# brush.pixelate mosaics whatever's already on screen inside the shape you draw,
# its block size pulsing - like a censor bar that follows the circle.

import math

badge.mode(LORES | VSYNC)
screen.font = rom_font.sins

def backdrop():
  # colourful spinning blobs for the effect to chew on
  for i in range(8):
    a = i / 8 * 2 * math.pi + badge.ticks / 1400
    screen.pen = color.hsv(i * 32, 200, 230)
    x = screen.width * 0.5 + math.cos(a) * screen.width * 0.26
    y = screen.height * 0.5 + math.sin(a) * screen.height * 0.26
    screen.shape(shape.circle(x, y, screen.width * 0.14))


while True:
  screen.antialias = image.X4
  backdrop()

  # mosaic a moving circular window over the backdrop; block size pulses
  size = int((math.sin(badge.ticks / 700) + 1) * 5) + 4
  cx = screen.width * 0.5 + math.sin(badge.ticks / 1100) * screen.width * 0.18
  cy = screen.height * 0.5
  r = screen.width * 0.2

  screen.pen = brush.pixelate(size)
  screen.shape(shape.circle(cx, cy, r))

  # outline the pixelated region
  screen.pen = color.rgb(255, 255, 255)
  screen.shape(shape.circle(cx, cy, r).stroke(2))
  screen.text(f"pixelate {size}", 5, screen.height - 12)
  badge.update()
