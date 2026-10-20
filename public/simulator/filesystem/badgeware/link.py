ID_LEN = 8


def badge_id_hex(badge_id):
    return "".join("%02x" % value for value in badge_id)


def draw_identicon(target, badge_id, x, y, size):
    previous_pen = target.pen
    value = 2166136261
    for byte in badge_id:
        value = ((value ^ byte) * 16777619) & 0xffffffff
    target.pen = color.rgb(88, 58, 247)
    cell = size / 5
    for row in range(5):
        for column in range(3):
            if value & (1 << (row * 3 + column)):
                for mirrored in {column, 4 - column}:
                    target.rectangle(x + mirrored * cell, y + row * cell, cell, cell)
    target.pen = previous_pen


def identicon(badge_id):
    icon = image(55, 55)
    draw_identicon(icon, badge_id, 0, 0, 55)
    return icon, color.rgb(88, 58, 247), color.rgb(13, 17, 23)


class Link:
    def __init__(self, game):
        self.game = game
        self.id = b"\x00\x00\x00\x00\x00\x00\x00\x01"
        self.name = "Simulated badge"
        self.partner = None
        self.linked = False
        print("Simulator: badge-to-badge communication is unavailable. Test pairing on your badge.")

    def pump(self):
        return None

    def update(self):
        return None

    def receive(self):
        return ()

    def send(self, message):
        return False

    def leave(self):
        self.partner = None
        self.linked = False

    def close(self):
        self.leave()

    def capacity(self):
        return 20


class Proximity:
    def __init__(self, link):
        self.link = link

    def rest(self, badge_id, now):
        return None

    def clear(self):
        return None

    def lights(self, now):
        return None

    def update(self, now):
        return None

    def syncing(self):
        return None

    def cooling(self, now):
        return None

    def progress(self, now):
        return 0.0
