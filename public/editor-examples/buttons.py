# Reading buttons. badge.update() polls them once per frame:
#   badge.pressed()  - true on the frame a button goes down
#   badge.held()     - true the whole time a button is down
#   badge.released() - true on the frame a button comes up
# Test a single button with: BUTTON_A in badge.pressed()

badge.mode(HIRES)

buttons = (("A", BUTTON_A), ("B", BUTTON_B), ("C", BUTTON_C),
           ("UP", BUTTON_UP), ("DOWN", BUTTON_DOWN))
log = []

while True:
    # Record every fresh press.
    for name, btn in buttons:
        if btn in badge.pressed():
            log.append(name + " pressed")
    log = log[-6:]

    screen.pen = color.white
    screen.text("Press A B C UP DOWN", 10, 10)

    # Light up A's label while it is held.
    screen.pen = color.lime if BUTTON_A in badge.held() else color.dark_grey
    screen.text("A held", 10, 40)

    screen.pen = color.grey
    for i, line in enumerate(log):
        screen.text(line, 10, 70 + i * 18)

    badge.update()
