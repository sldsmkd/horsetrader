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
# so a banner id appears on several rows; we keep the first (the structured
# fields are identical across them) — the career-occurrence dimension is not yet
# modelled. The gamey calendar-less pseudo-races (Debut/Maiden/Exhibition) reuse
# banner art across distinct races (9001, 9002), so they're filtered out by
# grade (`RaceGrade.is_fixture`); the survivors are 1:1 with banner id.
_RACES_URL_JP = "https://gametora.com/ja/umamusume/races"
_RACES_URL_EN = "https://gametora.com/umamusume/races"

_RACE_BANNER_EXPR = '//main//img[contains(@src, "/races/banners/")]'
_RACE_RIBBON_EXPR = './/img[contains(@src, "race_ribbons")]'
_BANNER_ID_PATTERN = re.compile(r"/races/banners/(?:en/)?(\d+)\.png")
_RIBBON_NUM_PATTERN = re.compile(r"grade_ribbon_(\d+)\.png")
_VARIES = "多様"  # Gametora's JP "varies" marker for randomly-generated fields


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

    def _scrape(self, url: str) -> dict[str, dict]:
        """{banner_id: row record} for one index page; first row per id wins."""
        tree = html.fromstring(self._uc.get(url, chrome=True, cache=CacheTime.INDEX))
        banners = xpath_all(tree, _RACE_BANNER_EXPR)
        if not banners:
            raise ValueError(f"Gametora races: no banners found on {url}")

        out: dict[str, dict] = {}
        for banner in banners:
            src = banner.get("src") or ""
            id_match = _BANNER_ID_PATTERN.search(src)
            if not id_match:
                continue
            banner_id = id_match.group(1)
            if banner_id in out:
                continue

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

            out[banner_id] = {
                "banner_id": banner_id,
                "banner_url": src,
                "grade": RaceGrade.from_ribbon(int(ribbon_match.group(1))),
                "tokens": tokens,
            }
        return out

    def races(self) -> Sequence[dict]:
        jp = self._scrape(_RACES_URL_JP)
        if not jp:
            raise ValueError("Gametora races: no records extracted from JP page")
        en = self._scrape(_RACES_URL_EN)
        if not en:
            raise ValueError("Gametora races: no records extracted from EN page")

        out: list[dict] = []
        for banner_id, jp_rec in sorted(jp.items()):
            grade = jp_rec["grade"]
            # Filter the gamey calendar-less pseudo-races (Debut/Maiden/Exhibition);
            # the survivors are real fixtures, 1:1 with banner id.
            if grade is None or not grade.is_fixture:
                continue

            tokens = jp_rec["tokens"]
            # JA row layout: [name, careerClass, timing, surface, racetrack,
            # distanceCategory, distance, "詳細"]. We take name + surface +
            # racetrack + distance; career/timing (the occurrence dimension) and
            # the distance-category bucket are deliberately not modelled yet.
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

            en_rec = en.get(banner_id)
            out.append(
                {
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
                }
            )
        logger.info("Extracted %d race fixtures from Gametora", len(out))
        return out
