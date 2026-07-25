import re
from collections.abc import Sequence

from lxml import html

from horsetrader.core import SingletonMeta
from horsetrader.enums import CacheTime, RaceGrade, Sources
from horsetrader.extractors.helpers import xpath_all, xpath_first
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)

# Races live on two Gametora surfaces sharing one keyspace — the race id in the
# banner image (`/races/banners/9002.png`, EN art at `/races/banners/en/9002.png`).
# The JA index is the substrate (JP names + JP-labelled surface/track); the
# locale-less index overlays the EN name. Joined by banner id.
#
# A race recurs once per career year it can be run in (Junior/Classic/Senior),
# so a banner id appears on several rows. Those rows fold into one fixture record
# with an `occurrences` list. The gamey pseudo-races (Debut/Maiden/EX) reuse
# banner art across distinct races (9001, 9002), so they are filtered out by
# grade (`RaceGrade.is_fixture`) and handled by career-schedule rules instead.
_RACES_URL_JP = "https://gametora.com/ja/umamusume/races"
_RACES_URL_EN = "https://gametora.com/umamusume/races"

_RACE_BANNER_EXPR = '//main//img[contains(@src, "/races/banners/")]'
_RACE_RIBBON_EXPR = './/img[contains(@src, "race_ribbons")]'
_BANNER_ID_PATTERN = re.compile(r"/races/banners/(?:en/)?(\d+)\.png")
_RIBBON_NUM_PATTERN = re.compile(r"grade_ribbon_(\d+)\.png")
_VARIES = "多様"  # Gametora's JP "varies" marker for randomly-generated fields
_CAREER_CLASSES = {
    "ジュニア級": "junior",
    "クラシック級": "classic",
    "シニア級": "senior",
}
_TIMING_PATTERN = re.compile(r"^(?P<month>\d{1,2})月\s*(?P<half>前半|後半)$")
_MONTH_HALVES = {"前半": "early", "後半": "late"}


@transcend
class GametoraRaces(metaclass=SingletonMeta):
    """Scraper for the Gametora races index (JA substrate + EN overlay).

    Returns raw record dicts for the real fixtures (Pre-Open … G1); entity
    construction and racetrack/surface/grade resolution are Digitan's job.
    """

    def __init__(self):
        self._uc = UmaClient()

    @staticmethod
    def _row_of(banner):
        """The race row owning `banner` — nearest ancestor carrying a grade ribbon."""
        node = banner
        for _ in range(8):
            node = node.getparent()
            if node is None:
                return None
            if node.xpath('.//img[contains(@src, "race_ribbons")]'):
                return node
        return None

    def _scrape(self, url: str) -> list[dict]:
        """Every race-table row on one locale's index page, in display order."""
        tree = html.fromstring(self._uc.get(url, chrome=True, cache=CacheTime.INDEX))
        banners = xpath_all(tree, _RACE_BANNER_EXPR)
        if not banners:
            raise ValueError(f"Gametora races: no banners found on {url}")

        out: list[dict] = []
        for banner in banners:
            src = banner.get("src") or ""
            id_match = _BANNER_ID_PATTERN.search(src)
            if not id_match:
                continue
            banner_id = id_match.group(1)

            row = self._row_of(banner)
            if row is None:
                continue
            ribbon = xpath_first(row, _RACE_RIBBON_EXPR)
            ribbon_match = (
                _RIBBON_NUM_PATTERN.search(ribbon.get("src") or "")
                if ribbon is not None
                else None
            )
            tokens = [t.strip() for t in row.itertext() if t.strip()]
            if not ribbon_match or not tokens:
                continue

            out.append(
                {
                    "banner_id": banner_id,
                    "banner_url": src,
                    "grade": RaceGrade.from_ribbon(int(ribbon_match.group(1))),
                    "tokens": tokens,
                }
            )
        return out

    @staticmethod
    def _occurrence(tokens: list[str], banner_id: str) -> dict:
        """Parse the JP career-class + half-month columns for one fixture row."""
        career_class = _CAREER_CLASSES.get(tokens[1])
        timing = _TIMING_PATTERN.fullmatch(tokens[2])
        if career_class is None or timing is None:
            raise ValueError(
                f"Race {banner_id}: invalid career occurrence "
                f"{tokens[1:3]!r}"
            )
        month = int(timing.group("month"))
        if not 1 <= month <= 12:
            raise ValueError(f"Race {banner_id}: invalid career month {month}")
        return {
            "career_class": career_class,
            "month": month,
            "half": _MONTH_HALVES[timing.group("half")],
        }

    def races(self) -> Sequence[dict]:
        jp_rows = self._scrape(_RACES_URL_JP)
        if not jp_rows:
            raise ValueError("Gametora races: no records extracted from JP page")
        en_rows = self._scrape(_RACES_URL_EN)
        if not en_rows:
            raise ValueError("Gametora races: no records extracted from EN page")
        en_by_id = {row["banner_id"]: row for row in en_rows}

        out_by_id: dict[str, dict] = {}
        for jp_rec in jp_rows:
            banner_id = jp_rec["banner_id"]
            grade = jp_rec["grade"]
            # Filter the gamey calendar-less pseudo-races (Debut/Maiden/Exhibition);
            # their generated schedules are not occurrences of named fixtures.
            if grade is None or not grade.is_fixture:
                continue

            tokens = jp_rec["tokens"]
            # JA row layout: [name, careerClass, timing, surface, racetrack,
            # distanceCategory, distance, "詳細"]. The fixture owns the stable
            # physical fields; career class + timing become one occurrence.
            if len(tokens) < 7:
                logger.warning("Race %s: short row %r; skipping", banner_id, tokens)
                continue
            # `多様` (Varies) racetrack/distance is legitimate: a few real G1s (the
            # JBC trio) run at a randomly generated venue/distance to suit the
            # runner's career. Surface stays fixed, so a Varies surface would be
            # anomalous — skip loudly rather than bake a race with no surface.
            if tokens[3] == _VARIES:
                logger.warning(
                    "Race %s (%s): Varies surface; skipping", banner_id, tokens[0]
                )
                continue
            distance_match = re.search(r"(\d+)", tokens[6])

            record = out_by_id.get(banner_id)
            if record is None:
                en_rec = en_by_id.get(banner_id)
                record = {
                    "key": f"race-{banner_id}",
                    "gametora_id": int(banner_id),
                    "name_jp": tokens[0],
                    "name_en": en_rec["tokens"][0] if en_rec else None,
                    "grade": grade.value,
                    "surface_jp": tokens[3],
                    "racetrack_name_jp": None if tokens[4] == _VARIES else tokens[4],
                    "distance": int(distance_match.group(1)) if distance_match else None,
                    # EN banner art when the race has reached Global, else the JA art.
                    "banner_url": en_rec["banner_url"] if en_rec else jp_rec["banner_url"],
                    "correlations": {Sources.GAMETORA.value: int(banner_id)},
                    "references": [_RACES_URL_JP, _RACES_URL_EN],
                    "occurrences": [],
                }
                out_by_id[banner_id] = record
            record["occurrences"].append(self._occurrence(tokens, banner_id))

        out = [out_by_id[key] for key in sorted(out_by_id)]
        logger.info(
            "Extracted %d race fixtures with %d career occurrences from Gametora",
            len(out),
            sum(len(record["occurrences"]) for record in out),
        )
        return out
