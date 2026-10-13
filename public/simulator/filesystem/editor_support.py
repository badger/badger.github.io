import builtins

builtins.BUTTON_LEFT = BUTTON_A
builtins.BUTTON_RIGHT = BUTTON_C
builtins.BUTTON_SELECT = BUTTON_B
builtins.BUTTON_BACK = BUTTON_HOME
builtins.BUTTON_MENU = BUTTON_HOME

if not hasattr(badge, "touched"):
    badge.touched = lambda button=None: badge.held(button)
if not hasattr(badge, "direction"):
    badge.direction = lambda: vec2(int(badge.held(BUTTON_RIGHT)) - int(badge.held(BUTTON_LEFT)), int(badge.held(BUTTON_DOWN)) - int(badge.held(BUTTON_UP)))
if not hasattr(badge, "imu"):
    badge.imu = lambda: (0, 0, 16384, 0, 0, 0)
if not hasattr(badge, "upside_down"):
    badge.upside_down = lambda: False
