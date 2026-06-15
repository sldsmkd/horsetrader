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

# Two celebration frames, both ending in a race token that's resolved as a
# curated alias / fixture name (never translated by string rules). Tolerant of
# GⅠ (roman numeral) vs G1 and optional spacing. Only ASCII () wrap the race;
# full-width （） are left inside the token because they're part of race names
# (天皇賞（春） → "Tenno Sho (Spring)").
#
# Seasonal, numbered:  秋のGⅠ記念ミッション 第3弾 ホープフルS
# Bare (dirt G1s):     GⅠ記念ミッション フェブラリーステークス
#
# The anchors are mutually exclusive (seasonal starts with a season kanji, bare
# with GⅠ/G1), so the EN template's slots are filled from whichever named groups
# the matching pattern provides.
_SEASONAL = re.compile(
    r"^(?P<season>[春夏秋冬])の(?:GⅠ|G1)記念ミッション"
    r"[\s　]*第(?P<n>\d+)弾[\s　]*\(?(?P<race>.+?)\)?$"
)
_BARE = re.compile(r"^(?:GⅠ|G1)記念ミッション[\s　]*\(?(?P<race>.+?)\)?$")

# Seasonal mirrors the shipped Gametora style ("Fall G1 Celebration Missions,
# Part 3: Hopeful Stakes"); the bare frame has no part number, so the race goes
# in parens ("G1 Celebration Missions (February Stakes)").
_FRAMES = (
    (_SEASONAL, "{season} G1 Celebration Missions, Part {n}: {race_en}"),
    (_BARE, "G1 Celebration Missions ({race_en})"),
)


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

        races = Races()
        for pattern, template in _FRAMES:
            match = pattern.match(title.jp)
            if match is None:
                continue

            race_en = self._resolve_race_en(match.group("race"), races)
            if race_en is None:
                # Unrecognised / unresolved race, or fixture not yet on Global
                # (e.g. マイルCS南部杯) — leave JP-only as the gap signal.
                return title

            groups = match.groupdict()
            fields = {"race_en": race_en}
            if groups.get("season"):
                fields["season"] = _SEASON[groups["season"]]
            if groups.get("n"):
                fields["n"] = groups["n"]
            projected = Japlish(title.jp, encoding="jp")
            projected.en = template.format(**fields)
            return projected

        return title

    def race(self, name: Japlish) -> Japlish:
        """Project a race name's JP text to its EN form via the curated fixture
        translations — the second #63 bucket (Legend Race titles are JP-only
        race names the `Race` entity already carries an EN for).

        Returns the name unchanged when no fixture resolves or the fixture has
        no EN yet (NAR/dirt races awaiting curation) — the gap signal stays.
        """
        from horsetrader.models.entities.race import Races

        race_en = self._resolve_race_en(name.jp, Races())
        if race_en is None:
            return name
        projected = Japlish(name.jp, encoding="jp")
        projected.en = race_en
        return projected

    def _resolve_race_en(self, token: str, races: "Races") -> str | None:
        """The race lookup shared by both projections: resolve the token to a
        fixture and return its EN name, or None when unresolved / EN-less."""
        race = self._resolve_race(token, races)
        if race is None:
            return None
        try:
            return race.name.en
        except ValueError:
            return None

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
