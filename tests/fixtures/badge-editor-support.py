import builtins
import importlib.util
from pathlib import Path
from types import SimpleNamespace

root = Path(__file__).resolve().parents[2] / "public/simulator/filesystem"
drawn = []
loaded = []
builtins.screen = SimpleNamespace(pen="original", shape=lambda value: drawn.append(value))
builtins.shape = SimpleNamespace(circle=lambda *args: ("circle", args), rounded_rectangle=lambda *args: ("rectangle", args))
builtins.color = SimpleNamespace(rgb=lambda *args: args)
builtins.font = SimpleNamespace(load=lambda path: loaded.append(path) or "mona-sans")
builtins.badge = SimpleNamespace(upside_down=lambda: False)


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, root / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


hints = load("hints", "hints.py")
details = load("missing_details", "missing_details.py")
pairing = load("pairing", "pairing.py")
link = load("editor_link", "badgeware/link.py")

assert details.mona_sans() == details.mona_sans() == "mona-sans"
assert loaded == ["/system/assets/fonts/MonaSans-Medium.af"]
assert hints.hint_width((), 4) == 0
assert hints.hint_width((1, 2, 3), 4) == 32
style = hints.Style("white", "dim", "black")
hints.draw_hint(style, (1, 2), (1,), 80, 219, 4)
assert len(drawn) == 2
assert screen.pen == "original"
badge.upside_down = lambda: True
assert hints.flipped()
hints.draw_hint(style, (1, 2), (1,), 80, 219, 4)
animation = pairing.Pairing(74, 138, 6)
animation.draw_together(1000)
animation.draw_apart()
animation.draw_loop(1000)
assert screen.pen == "original"
assert len(drawn) == 10

radio = link.Link("contacts")
assert radio.name and radio.id
assert radio.partner is None and not radio.linked
assert radio.receive() == ()
assert radio.send(b"private contact details") is False
assert radio.capacity() > 3
radio.pump()
radio.update()
proximity = link.Proximity(radio)
proximity.update(1000)
proximity.rest(b"peer", 1000)
assert proximity.syncing() is None
assert proximity.cooling(1000) is None
assert proximity.progress(1000) == 0
assert proximity.lights(1000) is None
proximity.clear()
assert link.badge_id_hex(b"\x00\x01\xff") == "0001ff"
target = SimpleNamespace(pen="original", rectangle=lambda *args: drawn.append(args))
link.draw_identicon(target, radio.id, 12, 16, 55)
assert target.pen == "original"
assert len(drawn) > 10
radio.partner = SimpleNamespace(id=b"peer")
radio.linked = True
radio.close()
assert radio.partner is None and not radio.linked
print("Contacts helper checks passed")
