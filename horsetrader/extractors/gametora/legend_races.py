import re
from datetime import datetime
from typing import Sequence

from lxml import html

from horsetrader.core import JST, Period, SingletonMeta
from horsetrader.enums import CacheTime
from horsetrader.extractors.helpers import xpath_first
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)

# Legend Races live on two Gametora surfaces sharing one chronological ordinal:
#   * the JA index renders the JP-server schedule — our source for the JP
#     `Period`, the ordered per-trainee legs, and the JP race name.
#   * the locale-less (EN) index renders the same cards with EN trainee links
#     and an EN race name — joined back by the card's trainee set.
_LEGEND_INDEX_URL = "https://gametora.com/ja/umamusume/events/legend-race"
_LEGEND_INDEX_URL_EN = "https://gametora.com/umamusume/events/legend-race"

_CHAR_HREF_FRAG = "/ja/umamusume/characters/"
_CHAR_SLUG_PATTERN = re.compile(r"/ja/umamusume/characters/([^/?#]+)$")
_CHAR_SLUG_PATTERN_EN = re.compile(r"^/umamusume/characters/([^/?#]+)$")
_JP_DATETIME_PATTERN = re.compile(r"(\d{4}年\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2})")

# A race card is the outermost div that holds BOTH a direct-child div with the
# overall JP date span (and no character links) AND a direct-child div listing
# the per-trainee legs (each leg a character link). Matched structurally, never
# by Gametora's styled-component class hashes (those churn on every rebuild).
_CARD_EXPR = (
    './/div['
    'div[.//span[contains(.,"年")] and not(.//a[contains(@href,"/ja/umamusume/characters/")])]'
    " and "
    'div[.//a[contains(@href,"/ja/umamusume/characters/")]]'
    "]"
)
_CARD_EXPR_EN = (
    './/div['
    'div[.//span[contains(.,",")] and not(.//a[starts-with(@href,"/umamusume/characters/")])]'
    " and "
    'div[.//a[starts-with(@href,"/umamusume/characters/")]]'
    "]"
)


@transcend
class GametoraLegendRaces(metaclass=SingletonMeta):
    """Scraper for Legend Race occurrences from the Gametora events index.

    Each occurrence is a real-world race (東京優駿, 皐月賞, …) run as an ordered
    sequence of per-trainee legs that contiguously subdivide the overall window
    (each leg pits the player against one specific trainee variant for ~3 days).
    JP periods + legs + the JP name come from the JA index; the EN race name is
    joined from the locale-less index by the card's trainee set. Returns raw
    record dicts; entity construction is Digitan's job.
    """

    def __init__(self):
        self._uc = UmaClient()

    @staticmethod
    def _parse_period(text: str) -> Period | None:
        """First two JP datetimes in `text` as a JST `Period` (start, end)."""
        matches = _JP_DATETIME_PATTERN.findall(
            " ".join(text.replace("\xa0", " ").split())
        )
        if len(matches) < 2:
            return None
        try:
            start = datetime.strptime(matches[0].strip(), "%Y年%m月%d日 %H:%M")
            end = datetime.strptime(matches[1].strip(), "%Y年%m月%d日 %H:%M")
        except ValueError:
            return None
        start = start.replace(tzinfo=JST)
        end = end.replace(tzinfo=JST)
        if end < start:
            return None
        return Period(start=start, span=end - start)

    @staticmethod
    def _find_cards(main, expr: str) -> list:
        """Outermost card divs matching `expr` (drop nested matches)."""
        candidates = main.xpath(expr)
        candidate_ids = {id(c) for c in candidates}
        return [
            c
            for c in candidates
            if not any(
                id(p) in candidate_ids
                for p in c.iterancestors("div")
                if p is not main
            )
        ]

    @staticmethod
    def _card_title(card) -> str:
        """First non-empty text in the card with no date and no track marker."""
        for elem in card.iter():
            text = (elem.text or "").strip()
            if text and "年" not in text and "|" not in text and len(text) > 1:
                return text
        return ""

    @staticmethod
    def _en_card_slugs(card) -> frozenset[str]:
        slugs: set[str] = set()
        for a in card.xpath(".//a"):
            match = _CHAR_SLUG_PATTERN_EN.match(a.get("href", ""))
            if match:
                slugs.add(match.group(1))
        return frozenset(slugs)

    def _fetch_en_names(self) -> dict[frozenset[str], str]:
        """{frozenset(trainee_slugs): EN race name} from the locale-less index."""
        try:
            tree = html.fromstring(
                self._uc.get(_LEGEND_INDEX_URL_EN, chrome=True, cache=CacheTime.INDEX)
            )
        except Exception:
            logger.warning("Failed to fetch EN legend race index page")
            return {}
        main = xpath_first(tree, "//main")
        if main is None:
            return {}
        names: dict[frozenset[str], str] = {}
        for card in self._find_cards(main, _CARD_EXPR_EN):
            slugs = self._en_card_slugs(card)
            title = self._card_title(card)
            if slugs and title:
                names[slugs] = title
        logger.info("Fetched %d EN legend race names", len(names))
        return names

    def legend_races(self) -> Sequence[dict]:
        tree = html.fromstring(
            self._uc.get(_LEGEND_INDEX_URL, chrome=True, cache=CacheTime.INDEX)
        )
        main = xpath_first(tree, "//main")
        if main is None:
            raise ValueError("Legend Race: main block not found on JA index")

        cards = self._find_cards(main, _CARD_EXPR)
        if not cards:
            raise ValueError("Legend Race: no cards found on JA index")

        parsed: list[dict] = []
        for card in cards:
            # Overall period = first direct-child div with dates but no char
            # links; trainee list = first direct-child div with char links.
            overall: Period | None = None
            trainee_list = None
            for child in card:
                has_chars = bool(
                    child.xpath(f'.//a[contains(@href,"{_CHAR_HREF_FRAG}")]')
                )
                if has_chars and trainee_list is None:
                    trainee_list = child
                elif not has_chars and overall is None:
                    overall = self._parse_period(child.text_content())
            if overall is None or trainee_list is None:
                logger.warning("Legend Race: card missing period or trainees — skipping")
                continue

            legs: list[dict] = []
            for item in trainee_list:
                links = item.xpath(f'.//a[contains(@href,"{_CHAR_HREF_FRAG}")]')
                if not links:
                    continue
                match = _CHAR_SLUG_PATTERN.search(links[0].get("href", ""))
                period = self._parse_period(item.text_content())
                if not match or period is None:
                    logger.warning("Legend Race: unparseable leg — skipping entry")
                    continue
                legs.append({"trainee_slug": match.group(1), "period": period})
            if not legs:
                logger.warning("Legend Race: no legs parsed for a card — skipping")
                continue

            parsed.append(
                {
                    "period": overall,
                    "title_jp": self._card_title(card),
                    "legs": legs,
                    "slugs": frozenset(leg["trainee_slug"] for leg in legs),
                }
            )

        parsed.sort(key=lambda r: r["period"].start)
        en_names = self._fetch_en_names()

        records: list[dict] = []
        for ordinal, race in enumerate(parsed, start=1):
            records.append(
                {
                    "key": f"legendrace-{ordinal:03d}",
                    "period": race["period"],
                    "title_jp": race["title_jp"],
                    "title_en": en_names.get(race["slugs"]),
                    "legs": race["legs"],
                    "references": [_LEGEND_INDEX_URL, _LEGEND_INDEX_URL_EN],
                }
            )
        logger.info("Extracted %d legend races from Gametora", len(records))
        return records
