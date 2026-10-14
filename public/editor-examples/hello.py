# The smallest Badgeware app.
#
# The screen starts cleared and badge.update() clears it again each frame, so
# you only need to draw. Set the pen colour, draw, then call badge.update().

badge.mode(HIRES)

while True:
    screen.pen = color.white
    screen.text("Hello, Badgeware!", 10, 10)

    badge.update()
