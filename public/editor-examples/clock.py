# The real-time clock. rtc.datetime() returns a tuple:
#   (year, month, day, hour, minute, second, weekday)
# The simulator appends a sub-seconds value, so take the first seven either way.

badge.mode(HIRES)

while True:
    year, month, day, hour, minute, second, weekday = rtc.datetime()[:7]

    clock = "{:02d}:{:02d}:{:02d}".format(hour, minute, second)
    date = "{:04d}-{:02d}-{:02d}".format(year, month, day)

    screen.font = rom_font.hungry
    screen.pen = color.white
    screen.text(clock, 40, 90)
    screen.pen = color.grey
    screen.text(date, 40, 130)

    badge.update()
