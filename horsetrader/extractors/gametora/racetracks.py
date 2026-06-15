import re
from collections.abc import Sequence

from lxml import html

from horsetrader.core import SingletonMeta
from horsetrader.enums import CacheTime, Sources
from horsetrader.extractors.helpers import xpath_all, xpath_first
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)

# Racetracks live on two Gametora surfaces sharing one keyspace — the slug in
# each card's detail-page link (`/racetracks/sapporo`), identical across locales
# and the handle the per-track detail pages (courses, races) hang off, so it's
# the stable key. The JA index renders the JP names (札幌, 函館, …); the
# locale-less index renders the EN names (Sapporo, Hakodate, …). Joined by slug.
_RACETRACKS_URL_JP = "https://gametora.com/ja/umamusume/racetracks"
_RACETRACKS_URL_EN = "https://gametora.com/umamusume/racetracks"

# Each card is an <a> wrapping the icon and the name div. Match by the stable
# media path / link shape, never by Gametora's styled-component class hashes
# (those churn on every rebuild).
_RACETRACK_CARD_EXPR = '//main//a[.//img[contains(@src, "/racetrack/icon/")]]'
_RACETRACK_IMG_EXPR = './/img[contains(@src, "/racetrack/icon/")]'
_RACETRACK_NAME_EXPR = './/div[normalize-space(text())][last()]'
_RACETRACK_ID_PATTERN = re.compile(r"/racetrack/icon/(?:thumb/)?(\d+)\.png")
_RACETRACK_SLUG_PATTERN = re.compile(r"/racetracks/([^/?#]+)$")

# Per-racetrack detail page (`/racetracks/sapporo`) — the track configuration:
# each course is an <h2> "1200 m・Turf[・Outer]" followed by a diagram image
# whose path carries the course id (`…/simple/en/10001/10101.png`). Surface and
# the optional inner/outer variant come straight off the EN label, so the JA
# detail page is unneeded (the enums carry the JP). Only the EN diagram is kept.
_RACETRACK_DETAIL_BASE = "https://gametora.com/umamusume/racetracks/"
_COURSE_LABEL_PATTERN = re.compile(
    r"^\s*(?P<distance>\d+)\s*m・(?P<surface>Turf|Dirt)(?:・(?P<variant>Inner|Outer))?\s*$"
)
_COURSE_DIAGRAM_EXPR = './following::img[contains(@src, "/simple/")][1]'
_COURSE_ID_PATTERN = re.compile(r"/simple/[a-z]+/\d+/(\d+)\.png")


@transcend
class GametoraRacetracks(metaclass=SingletonMeta):
    """Scraper for the Gametora racetracks index (EN + JP pages).

    Returns raw record dicts (icon id + JP/EN name + icon URL); entity
    construction is Digitan's job.
    """

    def __init__(self):
        self._uc = UmaClient()

    def _scrape(self, url: str) -> dict[str, dict]:
        tree = html.fromstring(self._uc.get(url, chrome=True, cache=CacheTime.INDEX))
        cards = xpath_all(tree, _RACETRACK_CARD_EXPR)
        if not cards:
            raise ValueError(f"Gametora racetracks: no cards found on {url}")

        out: dict[str, dict] = {}
        for card in cards:
            slug_match = _RACETRACK_SLUG_PATTERN.search(card.get("href") or "")
            if not slug_match:
                continue
            slug = slug_match.group(1)
            # First card for a slug wins — duplicates are gallery variants.
            if slug in out:
                continue

            img = xpath_first(card, _RACETRACK_IMG_EXPR)
            src = (img.get("src") if img is not None else "") or ""
            id_match = _RACETRACK_ID_PATTERN.search(src)

            name_node = xpath_first(card, _RACETRACK_NAME_EXPR)
            name = (name_node.text_content() if name_node is not None else "").strip()
            if not name:
                logger.warning(
                    "Empty name for racetrack %s on %s; skipping", slug, url
                )
                continue

            out[slug] = {
                "slug": slug,
                "name": name,
                "icon_url": src,
                "gametora_id": int(id_match.group(1)) if id_match else None,
            }
        return out

    def racetracks(self) -> Sequence[dict]:
        en = self._scrape(_RACETRACKS_URL_EN)
        if not en:
            raise ValueError("Gametora racetracks: no records extracted from EN page")
        jp = self._scrape(_RACETRACKS_URL_JP)
        if not jp:
            raise ValueError("Gametora racetracks: no records extracted from JP page")

        out: list[dict] = []
        for slug, en_rec in sorted(en.items()):
            jp_rec = jp.get(slug)
            if jp_rec is None:
                logger.warning("Gametora racetracks: no JP record for racetrack %s", slug)
            correlations = {}
            if en_rec["gametora_id"] is not None:
                correlations[Sources.GAMETORA.value] = en_rec["gametora_id"]
            out.append(
                {
                    "key": f"racetrack-{slug}",
                    "slug": slug,
                    "name_en": en_rec["name"],
                    "name_jp": jp_rec["name"] if jp_rec else None,
                    "icon_url": en_rec["icon_url"],
                    "correlations": correlations,
                    "references": [_RACETRACKS_URL_EN, _RACETRACKS_URL_JP],
                }
            )
        logger.info("Extracted %d racetracks from Gametora", len(out))
        return out

    def courses(self) -> Sequence[dict]:
        """Course records across every racetrack detail page (track configuration).

        Enumerates slugs from the EN index, then parses each detail page's course
        list. Keyed `course-<gametora-id>` and carrying the parent `racetrack-`
        key so the collection can resolve the back-ref.
        """
        slugs = sorted(self._scrape(_RACETRACKS_URL_EN))
        out: list[dict] = []
        for slug in slugs:
            out.extend(self._scrape_courses(slug))
        logger.info(
            "Extracted %d courses across %d racetracks", len(out), len(slugs)
        )
        return out

    def _scrape_courses(self, slug: str) -> list[dict]:
        url = f"{_RACETRACK_DETAIL_BASE}{slug}"
        tree = html.fromstring(self._uc.get(url, chrome=True, cache=CacheTime.LEAF))
        main = xpath_first(tree, "//main")
        if main is None:
            raise ValueError(f"Gametora racetracks: main not found on {url}")

        out: list[dict] = []
        for h2 in xpath_all(main, ".//h2"):
            match = _COURSE_LABEL_PATTERN.match(h2.text_content())
            if not match:
                continue
            diagram = xpath_first(h2, _COURSE_DIAGRAM_EXPR)
            src = (diagram.get("src") if diagram is not None else "") or ""
            id_match = _COURSE_ID_PATTERN.search(src)
            if not id_match:
                logger.warning(
                    "Course %r on %s has no diagram id; skipping",
                    match.group(0).strip(),
                    slug,
                )
                continue
            variant = match.group("variant")
            out.append(
                {
                    "key": f"course-{id_match.group(1)}",
                    "gametora_id": int(id_match.group(1)),
                    "racetrack_key": f"racetrack-{slug}",
                    "surface": match.group("surface").lower(),
                    "distance": int(match.group("distance")),
                    "variant": variant.lower() if variant else None,
                    "diagram_url": src,
                    "references": [url],
                }
            )
        if not out:
            raise ValueError(f"Gametora racetracks: no courses parsed on {url}")
        return out
