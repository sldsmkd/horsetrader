from horsetrader.core import Japlish
from horsetrader.models.entities import Character, Trainee


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


def _map_trainee(t: Trainee) -> dict:
    return {
        "character": t.character.key,
        "variant": _japlish(t.variant.title),
        "rarity": t.variant.rarity,
        "release": t.release.isoformat(),
        "thumbnail": str(t.thumbnail.url) if t.thumbnail else None,
        "portrait": str(t.portrait.url) if t.portrait else None,
    }


MAPPERS = {
    Character: _map_character,
    Trainee: _map_trainee,
}
