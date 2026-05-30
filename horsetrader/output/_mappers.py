from horsetrader.models.entities import Character, Support, Trainee


def _map_character(c: Character) -> dict:
    return {
        "name": c.name.display if c.name else None,
        "quote": c.quote.display if c.quote else None,
        "icon": str(c.icon.url) if c.icon else None,
        "portrait": str(c.portrait.url) if c.portrait else None,
    }


def _map_support(s: Support) -> dict:
    return {
        "character": s.character.key if s.character else None,
        "display": s.display.display if s.display else None,
        "type": s.type.value if s.type else None,
        "rarity": s.rarity.value if s.rarity else None,
        "title": s.title.display if s.title else None,
        "release": s.release.isoformat(),
        "thumbnail": str(s.thumbnail.url) if s.thumbnail else None,
        "art": str(s.art.url) if s.art else None,
    }


def _map_trainee(t: Trainee) -> dict:
    return {
        "character": t.character.key,
        "variant": t.variant.title.display if t.variant.title else None,
        "rarity": t.variant.rarity,
        "release": t.release.isoformat(),
        "thumbnail": str(t.thumbnail.url) if t.thumbnail else None,
        "portrait": str(t.portrait.url) if t.portrait else None,
    }


# Entities serialise through an exact-type lookup in `Bake._serialize` — no MRO
# walk, no base-class entry — so unlike events there's no contravariance to
# violate and the table stays. (Events own their wire shape via `Event.bake`.)
MAPPERS = {
    Character: _map_character,
    Support: _map_support,
    Trainee: _map_trainee,
}
