# Query the hardware: which badge it's running on, the battery level and
# voltage, and whether USB is connected or charging.

badge.mode(HIRES)

while True:
    lines = [
        "Model:   {}".format(badge.model),
        "Battery: {}%".format(badge.battery_level()),
        "Voltage: {:.2f} V".format(badge.battery_voltage()),
        "USB:     {}".format("yes" if badge.usb_connected() else "no"),
        "Charge:  {}".format("yes" if badge.is_charging() else "no"),
    ]

    screen.pen = color.white
    for i, line in enumerate(lines):
        screen.text(line, 20, 30 + i * 28)

    # A simple battery gauge (level is 0-100).
    level = badge.battery_level()
    screen.pen = color.grey
    screen.rectangle(20, 190, 200, 24)
    screen.pen = color.lime if level > 20 else color.red
    screen.rectangle(20, 190, level * 2, 24)

    badge.update()
