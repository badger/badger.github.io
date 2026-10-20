# SpriteSheet slices a grid of frames out of a single image. .animation()
# returns an AnimatedSprite; frame() picks a frame and wraps around the count,
# so dividing badge.ticks by a frame time plays it back.

badge.mode(HIRES)

# running.png is 7 frames of 32x32 in a single row: SpriteSheet(file, cols, rows)
sheet = SpriteSheet("/system/assets/squirrel-sprites/running.png", 7, 1)
runner = sheet.animation()

while True:
    # Advance one frame every 80ms.
    frame = runner.frame(badge.ticks / 80)

    # blit(image, rect) scales the sprite into a 96x96 box.
    x = screen.width // 2 - 48
    y = screen.height // 2 - 48
    screen.blit(frame, rect(x, y, 96, 96))

    screen.pen = color.white
    screen.text("SpriteSheet animation", 10, 10)

    badge.update()
