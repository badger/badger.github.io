# Simulator stand-in for the firmware's Sparkle supervisor (badger/lightshow-sparkle).
# The Bluetooth mesh is shimmed out: no scanning, advertising, or relaying. A local
# show runs the firmware's bouncing Invertocat and case light effect. Press SELECT
# three times to stop it, as on the badge.
import builtins
import math
import time

import machine

LOGO_PATH = "/system/assets/sparkle/invertocat.png"
LOGO_WIDTH = 34
LOGO_SPEED_PX_PER_SECOND = 18
LOCAL_RGB = 0x280137
LOCAL_DURATION_MS = 10 * 60 * 1000
LED_COUNT = 4
LED_MAXIMUM = 0.68
LED_MINIMUM = 0.025
EXIT_PRESS_COUNT = 3
EXIT_GAP_MS = 2000

_native_run = None
_requested = False


def _reflected_position(origin, velocity, elapsed_ms, limit):
    if limit <= 0:
        return 0
    period = limit * 2
    travel = (abs(int(velocity)) * max(0, elapsed_ms)) // 1000
    position = (int(origin) + (travel if velocity >= 0 else -travel)) % period
    if position > limit:
        position = period - position
    return max(0, min(limit, position))


class _Random:
    def __init__(self, seed):
        self.state = seed & 0xFFFFFFFF or 0xA341316C

    def between(self, minimum, maximum):
        value = self.state
        value ^= (value << 13) & 0xFFFFFFFF
        value ^= value >> 17
        value ^= (value << 5) & 0xFFFFFFFF
        self.state = value & 0xFFFFFFFF
        return minimum + self.state % (maximum - minimum + 1)


class _Show:
    def __init__(self, now):
        self.started_at = now
        self.logo = image.load(LOGO_PATH)
        self.logo_height = max(1, (self.logo.height * LOGO_WIDTH + self.logo.width // 2) // self.logo.width)
        random = _Random(now)
        self.leds = [(random.between(0, 999), random.between(700, 1200)) for _ in range(LED_COUNT)]
        self.origin = (random.between(0, self._max_x()), random.between(0, self._max_y()))
        self.velocity = tuple(LOGO_SPEED_PX_PER_SECOND if random.between(0, 1) else -LOGO_SPEED_PX_PER_SECOND for _ in range(2))
        self.exit_count = 0
        self.exit_deadline = None

    def _max_x(self):
        return max(0, screen.width - LOGO_WIDTH)

    def _max_y(self):
        return max(0, screen.height - self.logo_height)

    def _led(self, state, elapsed):
        phase = ((elapsed + state[0]) % state[1]) / state[1]
        envelope = (math.sin(phase * math.pi * 2 - math.pi / 2) + 1) / 2
        return LED_MINIMUM + envelope * (LED_MAXIMUM - LED_MINIMUM)

    def _exit_pressed(self, now):
        if self.exit_deadline is not None and time.ticks_diff(now, self.exit_deadline) > 0:
            self.exit_count = 0
            self.exit_deadline = None
        pressed = badge.pressed()
        if not pressed:
            return False
        pressed = tuple(pressed)
        if len(pressed) != 1 or pressed[0] != BUTTON_SELECT:
            self.exit_count = 0
            return False
        self.exit_count += 1
        self.exit_deadline = time.ticks_add(now, EXIT_GAP_MS)
        return self.exit_count >= EXIT_PRESS_COUNT

    def update(self, now):
        elapsed = max(0, time.ticks_diff(now, self.started_at))
        if elapsed >= LOCAL_DURATION_MS or self._exit_pressed(now):
            return False
        screen.pen = color.rgb((LOCAL_RGB >> 16) & 0xFF, (LOCAL_RGB >> 8) & 0xFF, LOCAL_RGB & 0xFF)
        screen.clear()
        x = _reflected_position(self.origin[0], self.velocity[0], elapsed, self._max_x())
        y = _reflected_position(self.origin[1], self.velocity[1], elapsed, self._max_y())
        screen.blit(self.logo, rect(0, 0, self.logo.width, self.logo.height), rect(x, y, LOGO_WIDTH, self.logo_height))
        badge.caselights(*[self._led(state, elapsed) for state in self.leds])
        return True


def _supervised_run(update, *args, **kwargs):
    global _requested
    builtins.run = _native_run
    if not _requested:
        return _native_run(update, *args, **kwargs)
    _requested = False
    show = [None]

    def tick():
        now = time.ticks_ms()
        if show[0] is None:
            show[0] = _Show(now)
        if show[0].update(now):
            return None
        badge.caselights(0, 0, 0, 0)
        machine.reset()
        return True

    try:
        return _native_run(tick, *args, **kwargs)
    finally:
        badge.caselights(0, 0, 0, 0)


def resume():
    pass


def request_local_show():
    global _native_run, _requested
    if _requested:
        return False
    _requested = True
    # MicroPython stores builtin overrides apart from the builtins module, so
    # read them by name rather than as builtins.run.
    if run is not _supervised_run:
        _native_run = run
        builtins.run = _supervised_run
    return True
