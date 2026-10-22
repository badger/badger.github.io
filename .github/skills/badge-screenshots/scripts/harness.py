# Runs on the badge. capture.py prepends APP and STEPS, then sends this with `mpremote run`.
# Replaces the app run loop to inject scripted presses and dump screen.raw (RGB565) between markers.
import builtins, badgeware, binascii, sys, time
_state = {"cur": set(), "f": 0}
def _pressed(b=None):
    return bool(_state["cur"]) if b is None else b in _state["cur"]
def _none(b=None):
    return False
badge.pressed = _pressed
badge.held = _none
badge.released = _none
def _dump(name):
    raw = screen.raw
    sys.stdout.write("@@SHOT " + name + " %d %d\n" % (screen.width, screen.height))
    for i in range(0, len(raw), 3000):
        sys.stdout.write(binascii.b2a_base64(raw[i:i+3000]))
    sys.stdout.write("@@END\n")
_plan = []
_f = 0
for wait, btn, shot in STEPS:
    _f += wait
    _plan.append((_f, btn, shot))
def _fake_run(update, *a, **k):
    i = 0
    f = 0
    while True:
        badge.poll()
        _state["cur"] = set()
        while i < len(_plan) and _plan[i][0] == f and _plan[i][1] is not None:
            _state["cur"].add(_plan[i][1]); break
        if badge.default_clear is not None:
            screen.clip = rect(0, 0, screen.width, screen.height)
            screen.pen = badge.default_clear
            screen.clear()
        if badge.default_pen is not None:
            screen.pen = badge.default_pen
        r = update()
        badgeware.display.update()
        while i < len(_plan) and _plan[i][0] <= f:
            if _plan[i][2]:
                _dump(_plan[i][2])
            i += 1
        if i >= len(_plan):
            raise SystemExit
        f += 1
        if r is not None:
            print("@@LAUNCH", r)
            badge.mode(0)
            launch(r)
            raise SystemExit
builtins.run = _fake_run
try:
    launch(APP)
except SystemExit:
    pass
print("@@DONE")
