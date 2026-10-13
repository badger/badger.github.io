import math
import time
import random

NORMAL_MODE_104HZ = 3
PERFORMANCE_MODE_416HZ = 4


class LSM6DS3:
    def __init__(self, i2c=None, mode=NORMAL_MODE_104HZ, address=0x6A):
        pass

    def get_readings(self):
        t = time.ticks_ms() / 1000.0
        ax = int(math.sin(t * 0.31) * 2000)
        ay = int(math.cos(t * 0.19) * 2000)
        az = 16384  # 1G on Z axis
        return (ax, ay, az, 0, 0, 0)
    
    def double_tap_detected(self):
        return random.choice((True, False))

