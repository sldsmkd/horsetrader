from horsetrader.core import Japlish
from horsetrader.models.entities import Character, Support, Trainee
from horsetrader.models.events import Banner


def _japlish(j: Japlish | None) -> str | None:
    if j is None:
        return None
    for attr in ("en", "jp"):
        try:
            return getattr(j, attr)
        except ValueError:
            pass
    return str(j)


def _map_character(c: Character) -> dict:
    return {
        "name": _japlish(c.name),
        "quote": _japlish(c.quote),
        "icon": str(c.icon.url) if c.icon else None,
        "portrait": str(c.portrait.url) if c.portrait else None,
    }


def _map_support(s: Support) -> dict:
    return {
        "character": s.character.key if s.character else None,
        "display": _japlish(s.display),
        "type": s.type.value if s.type else None,
        "rarity": s.rarity.value if s.rarity else None,
        "title": _japlish(s.title),
        "release": s.release.isoformat(),
        "thumbnail": str(s.thumbnail.url) if s.thumbnail else None,
        "art": str(s.art.url) if s.art else None,
    }


def _map_trainee(t: Trainee) -> dict:
    return {
        "character": t.character.key,
        "variant": _japlish(t.variant.title),
        "rarity": t.variant.rarity,
        "release": t.release.isoformat(),
        "thumbnail": str(t.thumbnail.url) if t.thumbnail else None,
        "portrait": str(t.portrait.url) if t.portrait else None,
    }


def _map_banner(b: Banner) -> dict:
    return {
        "type": b.type.name.lower(),
        "predicted": b.predicted,
        "start": b.period.start.date().isoformat(),
        "end": b.period.end.date().isoformat(),
        "contents": [c.key for c in b.contents],
    }


MAPPERS = {
    Character: _map_character,
    Support: _map_support,
    Trainee: _map_trainee,
    Banner: _map_banner,
}
