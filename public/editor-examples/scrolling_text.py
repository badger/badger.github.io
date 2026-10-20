# text.scroll returns a ready-made function that scrolls a string across the
# screen. Build it once, then call it every frame with the pen you want.

badge.mode(HIRES)

scroller = text.scroll("Badgeware  *  scrolling marquee  *  ", speed=40, font_size=4)

while True:
    screen.pen = color.rgb(0, 255, 160)
    scroller()

    badge.update()
