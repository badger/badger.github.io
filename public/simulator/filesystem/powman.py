WAKE_BUTTON_A = 0
WAKE_BUTTON_B = 1
WAKE_BUTTON_C = 2
WAKE_BUTTON_UP = 3
WAKE_BUTTON_DOWN = 4
WAKE_WATCHDOG = 241
WAKE_UNKNOWN = 255

def get_wake_reason():
    return 255


def pressed_to_wake():
    return False


def sleep():
    pass


def reset_into_msc():
    fatal_error("Error!", "MSC not supported in the simulator.")
