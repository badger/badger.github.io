_mona_sans = None


def mona_sans():
    global _mona_sans
    if _mona_sans is None:
        _mona_sans = font.load("/system/assets/fonts/MonaSans-Medium.af")
    return _mona_sans


def missing(*names):
    import secrets
    return [name for name in names if not getattr(secrets, name, "")]


def show(names, background=None):
    if callable(background):
        background()
    previous_font = screen.font
    previous_pen = screen.pen
    screen.pen = color.rgb(13, 17, 23, 230)
    screen.rectangle(8, 72, screen.width - 16, 104)
    screen.font = mona_sans()
    screen.pen = color.rgb(240, 246, 252)
    screen.text("Add your details in Settings", 16, 84, 16)
    screen.pen = color.rgb(139, 148, 158)
    screen.text(", ".join(names), rect(16, 112, screen.width - 32, 56), 13)
    screen.font = previous_font
    screen.pen = previous_pen
