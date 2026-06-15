from horsetrader.models.entities import Character, Support, Trainee

from ._records import CharacterRecord, SupportRecord, TraineeRecord


def _search_aliases(character: Character | None, own: list[str]) -> list[str]:
    """An atom's baked search phrases: its character's nicknames (which apply to
    every card of that character) then its own card-specific ones, order-
    preserved and de-duplicated. Both halves are already on the models — Digitan
    enriches them at load — so this is a pure view, no source-data side-load."""
    character_aliases = character.aliases if character else []
    return list(dict.fromkeys([*character_aliases, *own]))


def _map_character(c: Character) -> CharacterRecord:
    return CharacterRecord(
        name=c.name,
        quote=c.quote,
        icon=str(c.icon.url) if c.icon else None,
        portrait=str(c.portrait.url) if c.portrait else None,
    )


def _map_support(s: Support) -> SupportRecord:
    return SupportRecord(
        character=s.character.key if s.character else None,
        display=s.display,
        type=s.type.value if s.type else None,
        rarity=s.rarity.value if s.rarity else None,
        title=s.title,
        release=s.release.isoformat(),
        thumbnail=str(s.thumbnail.url) if s.thumbnail else None,
        art=str(s.art.url) if s.art else None,
        aliases=_search_aliases(s.character, s.aliases),
    )


def _map_trainee(t: Trainee) -> TraineeRecord:
    return TraineeRecord(
        character=t.character.key,
        variant=t.variant.title,
        rarity=t.variant.rarity,
        release=t.release.isoformat(),
        thumbnail=str(t.thumbnail.url) if t.thumbnail else None,
        portrait=str(t.portrait.url) if t.portrait else None,
        aliases=_search_aliases(t.character, t.aliases),
    )


# Entities serialise through an exact-type lookup in `Bake._serialize` — no MRO
# walk, no base-class entry — so unlike events there's no contravariance to
# violate and the table stays. (Events own their wire shape via `Event.bake`.)
MAPPERS = {
    Character: _map_character,
    Support: _map_support,
    Trainee: _map_trainee,
}
