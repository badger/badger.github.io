_mona_sans = None


def mona_sans():
    global _mona_sans
    if _mona_sans is None:
        _mona_sans = font.load("/system/assets/fonts/MonaSans-Medium.af")
    return _mona_sans


def missing(*names):
    import secrets
    return [name for name in names if not getattr(secrets, name, "")]


def show(names, background=None, details=None):
    if callable(background):
        background()
    previous_font = screen.font
    previous_pen = screen.pen
    screen.pen = color.rgb(13, 17, 23, 230)
    screen.rectangle(8, 72, screen.width - 16, 104)
    screen.font = mona_sans()
    screen.pen = color.rgb(240, 246, 252)
    screen.text("Set these in the Settings app, or over USB:", rect(16, 80, screen.width - 32, 32), 14)
    screen.pen = color.rgb(139, 148, 158)
    lines = details if details else (", ".join(names),)
    screen.text("\n".join(lines), rect(16, 116, screen.width - 32, 52), 13)
    screen.font = previous_font
    screen.pen = previous_pen
