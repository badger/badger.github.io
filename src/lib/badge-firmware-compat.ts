// Patches the vendored simulator runtime for firmware modules and APIs that are
// newer than it. Modules are registered in sys.modules rather than staged as
// files, so simulations still stage exactly the project's files. Hardware-only
// features (IR, LED shows) are inert.
export const firmwareCompat = `
import builtins, js, json as _json, machine, missing_details, secrets, sys

def _compat_module(name, force=False, **attributes):
    if force or name not in sys.modules:
        for key in list(attributes):
            value = attributes[key]
            if callable(value) and not isinstance(value, type):
                attributes[key] = staticmethod(value)
        sys.modules[name] = type(name, (), attributes)

def _js(name):
    try:
        return getattr(js, name)
    except AttributeError:
        return None

class _RemoteDescriptor:
    on_known = None

class _IR:
    def bind(self, descriptor):
        return descriptor

    def close(self):
        pass

_compat_module("aye_arr")
_compat_module("aye_arr.nec")
_compat_module("aye_arr.nec.remotes")
_compat_module("aye_arr.nec.remotes.descriptor", RemoteDescriptor=_RemoteDescriptor)
_compat_module("badgeware.ir", ir=_IR())

# Bluetooth is inert: radios never find a peer, so badge-to-badge apps such as
# Merge Conflict stay in their lobby and ask you to hold badges together.
class _UUID:
    def __init__(self, value):
        self.value = value

    def __eq__(self, other):
        return isinstance(other, _UUID) and other.value == self.value

    def __hash__(self):
        return hash(self.value)

class _BLE:
    def active(self, *args):
        return False

    def config(self, *args, **options):
        return b"\\x00\\x00\\x00\\x00\\x00\\x01" if "mac" in args else None

    def __getattr__(self, name):
        return lambda *args, **options: None

_compat_module("bluetooth", BLE=_BLE, UUID=_UUID, FLAG_READ=2, FLAG_WRITE=8, FLAG_NOTIFY=16, FLAG_WRITE_NO_RESPONSE=4, FLAG_INDICATE=32)

from badgeware import link as _link

def _draw_identicon(target, badge_id, x, y, size, pen=None, background=None):
    previous = target.pen
    if background is not None:
        target.pen = background
        target.rectangle(x, y, size, size)
    value = 2166136261
    for byte in badge_id:
        value = ((value ^ byte) * 16777619) & 0xffffffff
    target.pen = pen if pen is not None else color.rgb(88, 58, 247)
    cell = size / 5
    for row in range(5):
        for column in range(3):
            if value & (1 << (row * 3 + column)):
                for mirrored in {column, 4 - column}:
                    target.rectangle(x + mirrored * cell, y + row * cell, cell, cell)
    try:
        target.pen = previous
    except TypeError:
        pass

_link.draw_identicon = _draw_identicon
_link.Link.central = False
_link.Link.journal = None
_link.Proximity.sync_id = None
_link.Proximity.cooldown_ms = 1

# The badge's BACK and MENU touch pads are separate from HOME, which exits apps.
class _Action:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return self.name

builtins.BUTTON_BACK = _Action("BUTTON_BACK")
builtins.BUTTON_MENU = _Action("BUTTON_MENU")

# IMU readings come from the browser's devicemotion data. Without it, the
# badge is assumed to be held upright (gravity along -y, or +y upside down).
class _BrowserMotion:
    def get_readings(self):
        reading = _js("sim_motion")
        reading = reading() if reading else None
        if reading is None:
            return (0, 16384 if badge._upside_down else -16384, 0, 0, 0, 0)
        return tuple(int(reading[i]) for i in range(6))

    def double_tap_detected(self):
        return False

badge._imu = _BrowserMotion()
badge._imu_readings = badge._imu.get_readings()

# Wi-Fi always reports connected; HTTP goes through the browser (CORS applies).
# Sockets are not shimmed.
def _http(method, url, data=None, json=None, headers=None, **options):
    send = _js("sim_http")
    if not send:
        raise OSError("Network requests are unavailable")
    headers = dict(headers or {})
    if json is not None:
        data = _json.dumps(json)
        headers.setdefault("Content-Type", "application/json")
    if isinstance(data, dict):
        data = "&".join("%s=%s" % item for item in data.items())
        headers.setdefault("Content-Type", "application/x-www-form-urlencoded")
    if isinstance(data, (bytes, bytearray)):
        data = bytes(data).decode()
    result = send(method, url, _json.dumps(headers), data)
    if not int(result.status):
        raise OSError(str(result.error))
    return _Response(result)

class _Response:
    def __init__(self, result):
        self.status_code = int(result.status)
        self.reason = str(result.reason)
        self.url = str(result.url)
        self.content = bytes(result.body)
        self.encoding = "utf-8"
        self.headers = {}
        for line in str(result.headers).split("\\r\\n"):
            if ":" in line:
                key, value = line.split(":", 1)
                self.headers[key.strip().lower()] = value.strip()

    @property
    def text(self):
        return self.content.decode()

    @property
    def ok(self):
        return 200 <= self.status_code < 300

    def json(self):
        return _json.loads(self.content)

    def close(self):
        pass

def _request(method, url, **options):
    return _http(method.upper(), url, **options)

_requests = dict(
    request=_request,
    get=lambda url, **options: _http("GET", url, **options),
    post=lambda url, **options: _http("POST", url, **options),
    put=lambda url, **options: _http("PUT", url, **options),
    patch=lambda url, **options: _http("PATCH", url, **options),
    delete=lambda url, **options: _http("DELETE", url, **options),
    head=lambda url, **options: _http("HEAD", url, **options),
    Response=_Response,
)
_compat_module("requests", True, **_requests)
_compat_module("urequests", True, **_requests)

_address = ("192.168.4.2", "255.255.255.0", "192.168.4.1", "192.168.4.1")
_compat_module(
    "wifi",
    True,
    NOT_CONFIGURED=-4,
    connect=lambda *args, **options: True,
    disconnect=lambda: None,
    isconnected=lambda: True,
    is_connected=lambda: True,
    status=lambda: (3, "Connected via browser"),
    get_status=lambda *args: (3, "Connected via browser"),
    failure=lambda: False,
    ip=lambda: _address[0],
    ipv4=lambda: _address[0],
    ipv6=lambda: "::",
    subnet=lambda: _address[1],
    gateway=lambda: _address[2],
    nameserver=lambda: _address[3],
)

class _WLAN:
    def __init__(self, interface=0):
        self._active = True

    def active(self, value=None):
        if value is not None:
            self._active = bool(value)
        return self._active

    def connect(self, *args, **options):
        self._active = True

    def disconnect(self):
        pass

    def isconnected(self):
        return True

    def status(self, parameter=None):
        return -50 if parameter == "rssi" else 3

    def ifconfig(self, value=None):
        return _address

    def ipconfig(self, name=None, **options):
        return (_address[0], _address[1]) if name == "addr4" else None

    def config(self, name=None, **options):
        return {"ssid": secrets.WIFI_SSID, "essid": secrets.WIFI_SSID, "hostname": "badger"}.get(name) if name else None

    def scan(self):
        return []

_compat_module(
    "network",
    True,
    WLAN=_WLAN,
    STA_IF=0,
    AP_IF=1,
    STAT_IDLE=0,
    STAT_CONNECTING=1,
    STAT_WRONG_PASSWORD=-3,
    STAT_NO_AP_FOUND=-2,
    STAT_CONNECT_FAIL=-1,
    STAT_GOT_IP=3,
    hostname=lambda *args: "badger",
    country=lambda *args: "XX",
    ipconfig=lambda *args, **options: None,
    route=lambda: [],
)
_compat_module("ntptime", True, host="browser", settime=lambda *args: None)

class _HTTPException(Exception):
    pass

class _AsyncFetch:
    IDLE = 0
    FETCHING = 1
    DONE = 2
    ERROR = 3
    STATUS_TEXT = ("Idle", "Fetching via browser", "Done", "Error")
    MAX_HEADER_BYTES = 4096

# Mirrors the firmware's fetch.url: shows one fetching frame, then completes.
class _FetchUrl:
    def __init__(self, url, headers=None, method="GET", data=None, **options):
        self.url = url
        self.path = None
        self._request = (method, headers, data)
        self._checks = 0
        self._done = False
        self._error = None
        self._content = None

    def to(self, path):
        self.path = path
        return self

    def _step(self):
        if self._done:
            return
        self._checks += 1
        if self._checks < 2:
            return
        self._done = True
        method, headers, data = self._request
        try:
            response = _http(method, self.url, data=data, headers=headers)
            if not response.ok:
                raise _HTTPException("HTTP %d" % response.status_code)
            self._content = response.content
            if self.path:
                with open(self.path, "wb") as file:
                    file.write(self._content)
        except Exception as error:
            self._error = str(error) or error.__class__.__name__

    def __bool__(self):
        self._step()
        return self._done and self._error is None

    @property
    def done(self):
        self._step()
        return self._done

    @property
    def error(self):
        return self._error

    @property
    def state(self):
        if not self._done:
            return "Fetching via browser"
        return "Error: " + self._error if self._error else "Done"

    def data(self):
        self._step()
        return self._content

    def json(self):
        return _json.loads(self.data())

_compat_module("fetch", True, url=_FetchUrl, AsyncFetch=_AsyncFetch, HTTPException=_HTTPException)

if not secrets.WIFI_SSID:
    secrets.WIFI_SSID = "browser"
    secrets.WIFI_PASSWORD = "browser"

if not hasattr(display, "set_async"):
    display.set_async = lambda *args: None
if not hasattr(machine, "reset_cause"):
    machine.PWRON_RESET = 1
    machine.WDT_RESET = 3
    machine.reset_cause = lambda: machine.PWRON_RESET

_show_missing = missing_details.show

def _show_missing_details(names, background=None, details=()):
    _show_missing(names or [" ".join(details)], background)

missing_details.show = _show_missing_details

# The badge reboots into USB disk mode. Without USB in the browser, show the
# disk mode screen and wait for RESET (HOME in the simulator), as the badge does.
import powman, time as _time

def _reset_into_msc():
    lines = (("USB Disk Mode", color.rgb(95, 237, 131)), ("", None), ("Connect to a computer", color.white), ("to access the disk.", color.white), ("", None), ("Press RESET to reboot.", color.white))
    while True:
        try:
            screen.font = font.absolute
        except (OSError, NameError):
            pass
        screen.pen = color.black
        screen.shape(shape.rectangle(0, 0, screen.width, screen.height))
        _w, height = screen.measure_text("X")
        step = height + 4
        y = (screen.height - step * len(lines)) / 2
        for text, pen in lines:
            if text:
                screen.pen = pen
                width, _h = screen.measure_text(text)
                screen.text(text, (screen.width - width) / 2, y)
            y += step
        display.update()
        badge.poll()
        if badge.pressed(BUTTON_HOME):
            machine.reset()
        _time.sleep(0.05)

powman.WAKE_DOUBLETAP = getattr(powman, "WAKE_DOUBLETAP", 254)
powman.reset_into_msc = _reset_into_msc
`