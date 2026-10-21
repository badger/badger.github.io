import builtins
import js
import struct
import sys

builtins.BUTTON_LEFT = BUTTON_A
builtins.BUTTON_RIGHT = BUTTON_B
builtins.BUTTON_SELECT = BUTTON_C
builtins.BUTTON_BACK = BUTTON_HOME
builtins.BUTTON_MENU = BUTTON_HOME


class Controls:
    def __init__(self):
        self.set_state((), (), (), ())

    def set_state(self, held, pressed, released, changed):
        self._held = tuple(held)
        self._pressed = tuple(pressed)
        self._released = tuple(released)
        self._changed = tuple(changed)

    def update(self, held):
        current = set(held)
        previous = set(self._held)
        self.set_state(current, current - previous, previous - current, current ^ previous)

    def held(self, button=None):
        return self._held if button is None else button in self._held

    def pressed(self, button=None):
        return self._pressed if button is None else button in self._pressed

    def released(self, button=None):
        return self._released if button is None else button in self._released

    def changed(self, button=None):
        return self._changed if button is None else button in self._changed

    def touched(self, button=None):
        return self.held(button)

    def direction(self):
        return vec2(int(self.held(BUTTON_RIGHT)) - int(self.held(BUTTON_LEFT)), int(self.held(BUTTON_DOWN)) - int(self.held(BUTTON_UP)))


class Motion:
    def get_readings(self):
        return (0, 0, -16384 if badge._upside_down else 16384, 0, 0, 0)

    def double_tap_detected(self):
        return False


class Firmware:
    def __init__(self, device):
        self.device = device
        self.native_poll = device.poll
        self.native_held = device.held
        self.buttons = Controls()
        self.pad = Controls()
        self.all = Controls()
        self.automatic_rotation = True
        self.rotated = False
        self.last_orientation = None
        device._upside_down = False
        device._imu = Motion()
        device._imu_readings = device._imu.get_readings()
        device._imu_events = 0

    def autorotate(self, enabled=None):
        if enabled is not None:
            self.automatic_rotation = bool(enabled)
            if self.automatic_rotation:
                self.rotate_180(self.device._upside_down)
        return self.automatic_rotation

    def rotate_180(self, enabled=None):
        if enabled is not None:
            self.rotated = bool(enabled)
            try:
                js.sim_display_rotation(self.rotated)
            except AttributeError:
                pass
        return self.rotated

    def upside_down(self):
        return self.device._upside_down

    def imu(self):
        return self.device._imu_readings

    def poll(self):
        self.native_poll()
        self.buttons.update(self.native_held())
        mask = int(js.sim_buttons())
        self.device._upside_down = bool(mask & 32768)
        self.device._imu_readings = self.device._imu.get_readings()
        self.device._imu_events = int(self.device._imu.double_tap_detected())
        if self.last_orientation != self.device._upside_down:
            self.last_orientation = self.device._upside_down
            if self.automatic_rotation:
                self.rotate_180(self.device._upside_down)
        # With the display rotated, the touch pads swap directions to match it.
        if self.rotated:
            mapping = ((256, BUTTON_RIGHT), (512, BUTTON_LEFT), (1024, BUTTON_SELECT), (2048, BUTTON_DOWN), (4096, BUTTON_UP), (8192, BUTTON_BACK), (16384, BUTTON_MENU))
        else:
            mapping = ((256, BUTTON_LEFT), (512, BUTTON_RIGHT), (1024, BUTTON_SELECT), (2048, BUTTON_UP), (4096, BUTTON_DOWN), (8192, BUTTON_BACK), (16384, BUTTON_MENU))
        self.pad.update(action for bit, action in mapping if mask & bit)
        self.all.update(set(self.buttons.held()) | set(self.pad.held()))


firmware = Firmware(badge)
badge.buttons = firmware.buttons
badge.pad = firmware.pad
badge.all = firmware.all
badge.poll = firmware.poll
badge.autorotate = firmware.autorotate
badge.rotate_180 = firmware.rotate_180
badge.upside_down = firmware.upside_down
badge.imu = firmware.imu
for method in ("held", "pressed", "released", "changed", "touched", "direction"):
    setattr(badge, method, getattr(badge.all, method))

_backlight = 1.0


def set_backlight(value):
    global _backlight
    _backlight = max(0.0, min(1.0, value))
    display.backlight(_backlight)


def get_backlight():
    return _backlight


import badgeware
badgeware.get_backlight = get_backlight
badgeware.set_backlight = set_backlight


class Pointer:
    def __init__(self, buffer, size):
        if isinstance(buffer, int):
            raise RuntimeError("Raw memory pointers need testing on the badge.")
        self.buffer = buffer
        self.size = size
        self.format = {1: "<B", 2: "<H", 4: "<I"}[size]

    def __getitem__(self, index):
        return struct.unpack_from(self.format, self.buffer, index * self.size)[0]

    def __setitem__(self, index, value):
        struct.pack_into(self.format, self.buffer, index * self.size, int(value) & ((1 << (8 * self.size)) - 1))


_native_notice = False


def native(function):
    global _native_notice
    if not _native_notice:
        print("Simulator: native and Viper functions run as Python; performance differs from the badge.")
        _native_notice = True
    return function


viper = native
builtins.editor_support = sys.modules[__name__]
builtins.ptr8 = lambda buffer: Pointer(buffer, 1)
builtins.ptr16 = lambda buffer: Pointer(buffer, 2)
builtins.ptr32 = lambda buffer: Pointer(buffer, 4)
builtins.uint = lambda value: int(value) & 0xffffffff


class AnimatedSprite:
    def __init__(self, sheet, frames):
        self.sheet = sheet
        self.frames = tuple(frames)
        if not self.frames:
            raise ValueError("An animation needs at least one frame.")

    def frame(self, index):
        return self.sheet.frame(self.frames[int(index) % len(self.frames)])


class SpriteSheet:
    def __init__(self, source, columns, rows):
        self.source = image.load(source) if isinstance(source, str) else source
        self.columns = int(columns)
        self.rows = int(rows)
        if self.columns < 1 or self.rows < 1:
            raise ValueError("Sprite sheet dimensions must be positive.")
        self.width = self.source.width // self.columns
        self.height = self.source.height // self.rows
        self.frames = {}

    def frame(self, index):
        index = int(index) % (self.columns * self.rows)
        if index not in self.frames:
            sprite = image(self.width, self.height)
            source = rect(index % self.columns * self.width, index // self.columns * self.height, self.width, self.height)
            sprite.blit(self.source, source, rect(0, 0, self.width, self.height))
            self.frames[index] = sprite
        return self.frames[index]

    def animation(self, frames=None):
        return AnimatedSprite(self, range(self.columns * self.rows) if frames is None else frames)


if not hasattr(builtins, "SpriteSheet"):
    builtins.SpriteSheet = SpriteSheet
    builtins.AnimatedSprite = AnimatedSprite
