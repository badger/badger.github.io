# State saves a dict to flash as JSON so it survives a reset. Load it with a
# dict of defaults at startup, then save whenever the value changes.

badge.mode(HIRES)

# load() fills this dict from /state/counter.json if it has been saved before.
data = {"count": 0}
State.load("counter", data)

while True:
    # A and C change the counter; save the new value straight away.
    if BUTTON_A in badge.pressed():
        data["count"] -= 1
        State.save("counter", data)
    if BUTTON_C in badge.pressed():
        data["count"] += 1
        State.save("counter", data)

    screen.pen = color.white
    screen.text("Count: {}".format(data["count"]), 20, 40)
    screen.pen = color.grey
    screen.text("A: -1    C: +1    (saved to flash)", 20, 80)

    badge.update()
