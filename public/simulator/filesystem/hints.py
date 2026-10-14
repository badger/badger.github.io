class Style:
    def __init__(self, foreground, inactive, background):
        self.foreground = foreground
        self.inactive = inactive
        self.background = background


def flipped():
    return badge.upside_down()


def hint_width(buttons, radius=4):
    return max(0, len(buttons) * radius * 3 - radius)


def hint_height(buttons, radius=4):
    return radius * 2 if buttons else 0


def draw_hint(style, buttons, active, x, y, radius=4):
    previous_pen = screen.pen
    left = x - hint_width(buttons, radius) / 2 + radius
    ordered = tuple(reversed(buttons)) if flipped() else buttons
    for index, button in enumerate(ordered):
        screen.pen = style.foreground if button in active else style.inactive
        screen.shape(shape.circle(left + index * radius * 3, y, radius))
    screen.pen = previous_pen
