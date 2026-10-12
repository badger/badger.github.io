# A scrolling selection menu driven by the UP and DOWN buttons.
#
# The selected index wraps around the list with the % (modulo) operator.

badge.mode(HIRES)

items = ["New game", "Continue", "Options", "Credits", "Quit"]
selected = 0

while True:
    if BUTTON_UP in badge.pressed():
        selected -= 1
    if BUTTON_DOWN in badge.pressed():
        selected += 1
    selected %= len(items)

    screen.pen = color.white
    screen.text("MENU", 10, 10)

    for i, label in enumerate(items):
        y = 40 + i * 28
        if i == selected:
            # Highlight bar behind the current item.
            screen.pen = color.rgb(60, 120, 255)
            screen.rectangle(8, y - 4, 304, 24)
            screen.pen = color.white
        else:
            screen.pen = color.grey
        screen.text(label, 16, y)

    badge.update()
