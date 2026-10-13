import math
import time


class BreakoutLTR559:
    def __init__(self, i2c=None, address=0x23):
        pass

    def get_reading(self):
        t = time.ticks_ms() / 1000.0
        lux = 128 + math.sin(t * 0.2) * 80
        return (0, 0, 0, 0, 0, 0, lux)
