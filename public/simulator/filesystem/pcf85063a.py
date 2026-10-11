import time

class PCF85063A:
    def __init__(self, *args, **kwargs):
        pass

    def datetime(self, *args, **kwargs):
        if len(args):
            pass
        year, month, day, hour, minute, second, weekday, _ = time.localtime()
        return (year, month, day, hour, minute, second, weekday)