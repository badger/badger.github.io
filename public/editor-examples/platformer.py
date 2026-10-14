# A tiny side-scroller. Hold A or C to run left/right, tap B to jump.
#
# Gravity is added to the vertical velocity every frame and the player is
# clamped to the floor.

badge.mode(HIRES)

FLOOR = 200

x, y = 160, FLOOR
vel_x, vel_y = 0.0, 0.0

while True:
    # Steer while A or C is held.
    if BUTTON_A in badge.held():
        vel_x = -3
    elif BUTTON_C in badge.held():
        vel_x = 3

    # Jump only when standing on the floor.
    if BUTTON_B in badge.pressed() and y >= FLOOR:
        vel_y = -7

    # Friction slows sideways motion; gravity pulls down.
    vel_x *= 0.8
    vel_y += 0.3

    x += vel_x
    y += vel_y

    # Land on the floor.
    if y > FLOOR:
        y = FLOOR
        vel_y = 0

    screen.pen = color.rgb(40, 90, 40)
    screen.rectangle(0, FLOOR + 8, screen.width, 40)
    screen.pen = color.rgb(255, 0, 255)
    screen.circle(int(x), int(y), 8)

    badge.update()
