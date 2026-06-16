"""Mission-title JP→EN tokenizer — the bulk of `Translate`, broken out so the
facade stays thin as coverage grows to other surfaces.

A celebration title is a sequence of independent tokens — a season prefix, the
``G1`` marker, the ``記念ミッション`` ("Celebration Missions") core, a ``第N弾``
("Part N") counter, and a trailing race name — each translated on its own, then
reassembled to ONE canonical style. Whatever is left after the recognised tokens
are peeled off is the race token, resolved via `_races`. Everything else is a
small set of hand-curated whole-string maps.

We translate to a canonical, deterministic style rather than chasing Gametora's
shipped strings, which are internally inconsistent across eras (Fall vs Autumn,
romanisation drift, ``Part N: race`` vs ``Part N (race)``). A scratch benchmark
against six years of Gametora's own EN pages confirmed every JP mission title
resolves mechanically — so a miss here is a defect, and `translate` halts loud
rather than letting an untranslated mission ship silently.
"""

import re

from horsetrader.extractors.static import Static
from horsetrader.info import Logger

from . import _races

logger = Logger.get(__name__)

# ── tokens ────────────────────────────────────────────────────────────────────
# 記念ミッション = "Celebration Missions" and 第N弾 = "Part N" are shared by both the
# anniversary and G1 tiers. GⅠ (roman numeral U+2160) and G1 (ascii) are normalised
# to G1 before matching. The season prefix is JRA's spring/autumn split, not
# meteorological — only those two ever appear.
KINEN = "Celebration Missions"
_KINEN = re.compile(r"記念ミッション")
_PART = re.compile(r"第(?P<n>\d+)弾")
_SEASON = re.compile(r"^(?P<season>[春秋])の(?=G1)")
_G1 = re.compile(r"G1")
SEASONS = {"春": "Spring", "秋": "Fall"}

_ANNIVERSARY = "Anniversary"  # the "who" is already EN-stamped in the source

# Whole-string one-offs that fit no frame are curated in the static corpus
# (`translate-mission-*`), matched whole and translated whole.


def translate(jp: str) -> str:
    """Project a mission title's JP text to canonical EN. Coverage is believed
    complete, so an untranslatable title halts the run (`logger.error`) rather
    than shipping silently."""
    en = _project(jp)
    if en is None:
        logger.error("Untranslatable mission title (no tier matched): %r", jp)
    assert en is not None  # the error above halts the run; satisfies the type checker
    return en


def _project(jp: str) -> str | None:
    """The tokenizer: tier-1 whole-string, tier-2 anniversary, tier-3 G1
    celebration. None when nothing matches."""
    jp = jp.replace("GⅠ", "G1").strip()

    full_tokens = Static().mission_translations()
    if jp in full_tokens:
        return full_tokens[jp]

    if _ANNIVERSARY in jp:
        who, _, _ = jp.partition("記念ミッション")
        part = _PART.search(jp)
        if who.strip() and part:
            return f"{who.strip()} {KINEN}, Part {part.group('n')}"
        return None

    if _G1.search(jp) and _KINEN.search(jp):
        return _celebration(jp)

    return None


def _celebration(jp: str) -> str | None:
    """Peel the named tokens off a G1 celebration title; the remainder is the
    race token, resolved against the race domain."""
    rest = jp

    season = None
    if m := _SEASON.match(rest):
        season = SEASONS[m.group("season")]
        rest = rest[m.end():]

    part = None
    if m := _PART.search(rest):
        part = m.group("n")
        rest = rest[: m.start()] + rest[m.end():]

    rest = _KINEN.sub("", rest, count=1)
    rest = _G1.sub("", rest, count=1)
    race = _races.resolve_en(rest.strip(" 　()"))
    if race is None:
        return None

    lead = f"{season} G1" if season else "G1"
    part_tok = f", Part {part}" if part else ""
    return f"{lead} {KINEN}{part_tok}: {race}"
