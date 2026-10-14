# Visualise the tweening curves from the `easing` module.
#
# Each easing function maps x (0.0-1.0) to an eased value (usually 0.0-1.0, but
# "back" and "elastic" overshoot past the ends). UP/DOWN picks a curve; a dot
# traces it in time while the ball below shows how the motion actually feels.

import easing

badge.mode(HIRES)

names = [
    "linear",
    "easeInOutSine",
    "easeInOutQuad",
    "easeInOutCubic",
    "easeOutQuint",
    "easeOutExpo",
    "easeInOutCirc",
    "easeInOutBack",
    "easeOutElastic",
    "easeInOutElastic",
    "easeOutBounce",
    "easeInOutBounce",
]

# Plot rectangle: x, y, width, height.
PX, PY, PW, PH = 40, 36, 256, 150

selected = 0

while True:
    if BUTTON_UP in badge.pressed():
        selected = (selected - 1) % len(names)
    if BUTTON_DOWN in badge.pressed():
        selected = (selected + 1) % len(names)

    ease = getattr(easing, names[selected])

    # Plot background and the v=0 / v=1 guide lines.
    screen.pen = color.rgb(28, 32, 42)
    screen.rectangle(PX, PY, PW, PH)
    screen.pen = color.rgb(55, 62, 78)
    screen.line(PX, PY + PH, PX + PW, PY + PH)   # v = 0 (bottom)
    screen.line(PX, PY, PX + PW, PY)             # v = 1 (top)

    # Plot the curve, segment by segment.
    screen.pen = color.rgb(80, 200, 255)
    prev_y = None
    for i in range(PW + 1):
        y = PY + PH - ease(i / PW) * PH
        if prev_y is not None:
            screen.line(PX + i - 1, int(prev_y), PX + i, int(y))
        prev_y = y

    # Loop t over ~1.5s and trace the curve with a dot.
    t = (badge.ticks % 1500) / 1500
    v = ease(t)
    dot_x = int(PX + t * PW)
    dot_y = int(PY + PH - v * PH)
    screen.pen = color.rgb(110, 116, 134)
    screen.line(dot_x, PY, dot_x, PY + PH)
    screen.pen = color.rgb(255, 200, 40)
    screen.circle(dot_x, dot_y, 4)

    # A ball driven by the eased value, clamped on-screen so overshoot still reads.
    ball_x = int(clamp(PX + v * PW, 8, screen.width - 8))
    screen.pen = color.rgb(255, 100, 160)
    screen.circle(ball_x, PY + PH + 28, 6)

    # Labels.
    screen.pen = color.white
    screen.text(names[selected], PX, 14)
    screen.pen = color.grey
    screen.text("UP / DOWN: change easing", PX, PY + PH + 46)

    badge.update()
