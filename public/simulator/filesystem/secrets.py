WIFI_SSID = ""
WIFI_PASSWORD = ""
REGION = "eu"
TIMEZONE = 0
GITHUB_USERNAME = ""
GITHUB_TOKEN = ""


def require(*names):
    for name in names:
        if name not in globals():
            raise ValueError("Missing simulator setting: " + name)


def locked(name):
    return False


def save(values):
    from badgeware import State
    State.modify("editor-settings", values)
    globals().update(values)


from badgeware import State
_saved = {}
State.load("editor-settings", _saved)
globals().update(_saved)
