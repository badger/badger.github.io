import math


class Pairing:
    def __init__(self, x, y, unit):
        self.x = x
        self.y = y
        self.unit = unit

    def _draw(self, distance, angle=0):
        previous_pen = screen.pen
        screen.pen = color.rgb(88, 58, 247)
        dx = math.cos(angle) * distance * self.unit
        dy = math.sin(angle) * distance * self.unit
        for sign in (-1, 1):
            x = self.x + sign * dx
            y = self.y + sign * dy
            screen.shape(shape.rounded_rectangle(x - self.unit * 2, y - self.unit * 3, self.unit * 4, self.unit * 6, self.unit))
        screen.pen = previous_pen

    def draw_together(self, now):
        self._draw(2.5 + abs(math.sin(now / 500)))

    def draw_apart(self):
        self._draw(4)

    def draw_loop(self, now):
        self._draw(3.5, now / 1200)
