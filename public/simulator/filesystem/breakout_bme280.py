import math
import time


class BreakoutBME280:
    def __init__(self, i2c=None, address=0x77):
        pass

    def read(self):
        t = time.ticks_ms() / 1000.0
        temp = 22.0 + math.sin(t * 0.1) * 2.0
        pressure = 101325.0 + math.sin(t * 0.07) * 500.0
        humidity = 55.0 + math.sin(t * 0.13) * 5.0
        return (temp, pressure, humidity)
