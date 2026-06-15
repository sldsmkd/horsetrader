"""Shuttle's JP→EN projection service.

`Translate` is the first entry in the conventional `services/` namespace
(see ``semantics/overview.md``). It owns the JP↔EN seam at the *use-case*
level: given a Japanese string, project its English form by leaning on the
entities that already carry curated translations — the race domain
(`Races`), which is the bulk of the mission-name gap (#63).

Singleton imports are deferred to method bodies on purpose:

- **Cycle.** The mission-build path (`models/events/mission.py`) is the
  intended caller, so a module-level model import would close a
  ``models → services → models`` cycle. By the time a method runs, the model
  packages are fully loaded.
- **Cost.** Instantiating the `Races` singleton kicks off a Gametora scrape;
  we only want that on first real call, not at import.

The same name is imported under ``TYPE_CHECKING`` purely as IDE/type-checker
convenience for annotations — that import is erased at runtime, so it neither
costs anything nor reintroduces the cycle.

`mission` is a pure projection: it recognises the GⅠ-celebration family and
nothing else, returning the title unchanged for anything it can't confidently
translate (anniversary / scenario-launch / story missions, year-stamped JBC
occurrences, races not yet on Global). The JP-only fall-through is the intended
translation-gap signal, not a failure.
"""

import re
from typing import TYPE_CHECKING

from horsetrader.core import Japlish
from horsetrader.info import Logger
from horsetrader.semantics import shuttle

if TYPE_CHECKING:
    from horsetrader.models.entities.race import Race, Races

logger = Logger.get(__name__)

# 春/秋 as a *season prefix* — distinct from the same kanji inside a race name
# (天皇賞（秋）→ "Tenno Sho (Autumn)"), which is why the race half is resolved as
# an entity rather than token-translated.
_SEASON = {"春": "Spring", "夏": "Summer", "秋": "Fall", "冬": "Winter"}

# 秋のGⅠ記念ミッション 第3弾 ホープフルS  →  groups(season, n, race token).
# Tolerant of GⅠ (roman numeral) vs G1, optional spacing, and the paren variant
# 春のG1記念ミッション 第2弾(オークス). The race token is matched as the curated
# alias / fixture name; it is NOT translated by string rules.
_CELEBRATION = re.compile(
    r"^(?P<season>[春夏秋冬])の(?:GⅠ|G1)記念ミッション"
    r"[\s　]*第(?P<n>\d+)弾[\s　]*[（(]?(?P<race>[^（）()]+?)[）)]?$"
)

# Shipped Gametora style: "Fall G1 Celebration Missions, Part 3: Hopeful Stakes".
_FRAME = "{season} G1 Celebration Missions, Part {n}: {race_en}"


@shuttle
class Translate:
    def mission(self, title: Japlish) -> Japlish:
        """Project a celebration-mission title's JP text to EN by resolving the
        embedded race name against the curated fixture translations.

        Returns the title unchanged when it isn't a recognised celebration
        frame, or when the embedded race can't be resolved to a fixture with an
        EN name — keeping the translation-gap signal intact.
        """
        from horsetrader.models.entities.race import Races

        match = _CELEBRATION.match(title.jp)
        if match is None:
            return title

        race = self._resolve_race(match.group("race"), Races())
        if race is None:
            return title
        try:
            race_en = race.name.en
        except ValueError:
            # Fixture not yet on Global (e.g. マイルCS南部杯) — leave JP-only.
            return title

        en = _FRAME.format(
            season=_SEASON[match.group("season")],
            n=match.group("n"),
            race_en=race_en,
        )
        projected = Japlish(title.jp, encoding="jp")
        projected.en = en
        return projected

    @staticmethod
    def _resolve_race(token: str, races: "Races") -> "Race | None":
        """Resolve a mission-title race token to its fixture.

        Exact name / alias equality wins, so マイルCS picks マイルチャンピオンシップ
        rather than also dragging in マイルチャンピオンシップ南部杯 (whose alias is the
        longer マイルCS南部杯). Falls back to substring search only when it's
        unambiguous; otherwise gives up rather than guess.
        """
        token = token.strip()
        for race in races.values():
            if race.name.jp == token or token in race.aliases:
                return race
        hits = races.search(token)
        if len(hits) == 1:
            return hits[0]
        if hits:
            logger.debug("Ambiguous race token %r -> %s", token, [h.key for h in hits])
        return None
