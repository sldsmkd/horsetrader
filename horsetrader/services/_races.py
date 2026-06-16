"""Race-name JP→EN resolution, shared by the mission tokenizer and the bare
`Translate.race` (Legend Race) projection.

A soft resolver: returns None when a token resolves to no fixture, or the
fixture has no EN yet (NAR/local/overseas races awaiting curation). Callers
decide whether that None is a gap signal (race) or a halt-worthy defect
(mission, where coverage is believed complete).
"""

import re
from typing import TYPE_CHECKING

from horsetrader.extractors.static import Static
from horsetrader.info import Logger

if TYPE_CHECKING:
    from horsetrader.models.entities.race import Race, Races

logger = Logger.get(__name__)

# NAR/local races whose `Race` entity has no `.en` yet are curated in the static
# corpus (`translate-race-*`); the JBC year-stamps are derived (no fixed fixture).
_JBC = re.compile(r"^JBC(?P<year>\d{4})$")  # year-stamped — pass through


def resolve_en(token: str) -> str | None:
    """Resolve a JP race token to its curated EN name: the curated NAR map first,
    then the JBC year pass-through, then the `Race` entity. None when unresolved /
    the fixture has no EN yet."""
    token = token.strip()
    race_tokens = Static().race_translations()
    if token in race_tokens:
        return race_tokens[token]
    if m := _JBC.match(token):
        return f"JBC {m.group('year')}"

    from horsetrader.models.entities.race import Races

    race = _resolve(token, Races())
    if race is None:
        return None
    try:
        return race.name.en
    except ValueError:
        return None


def _resolve(token: str, races: "Races") -> "Race | None":
    """Resolve a race token to its fixture. Exact name / alias equality wins, so
    マイルCS picks マイルチャンピオンシップ rather than also dragging in
    マイルチャンピオンシップ南部杯; falls back to an unambiguous substring hit,
    otherwise gives up rather than guess."""
    for race in races.values():
        if race.name.jp == token or token in race.aliases:
            return race
    hits = races.search(token)
    if len(hits) == 1:
        return hits[0]
    if hits:
        logger.debug("Ambiguous race token %r -> %s", token, [h.key for h in hits])
    return None
