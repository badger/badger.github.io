def connect(*args, **kwargs):
    return False


def disconnect():
    return None


def isconnected():
    return False


is_connected = isconnected


def failure():
    return True


def status():
    return -1, "Wi-Fi is unavailable in the simulator."
