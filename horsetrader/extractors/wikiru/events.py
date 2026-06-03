import re
from datetime import datetime
from typing import Sequence

from lxml import html

from horsetrader.core import JST, Period, SingletonMeta
from horsetrader.enums import CacheTime
from horsetrader.extractors.helpers import xpath_all
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)

# The single wikiru "event history" index (イベント一覧). One static HTML page
# (no JS), so plain HTTP — no chrome. Every event *type* Gametora doesn't cover
# is anchored under its own heading here (Showtime, League of Heroes, Racing
# Carnival, Trainer Skills Test, ...), each followed by one `style_table` of
# `No. | 開催期間 | イベント名` rows. This is the shared JP substrate; per-type
# scrapers are thin wrappers over `_section_rows`.
_EVENT_INDEX_URL = (
    "https://umamusume.wikiru.jp/index.php?"
    "%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88%E4%B8%80%E8%A6%A7"
)

# Sections are matched by heading *text*, never by pukiwiki's auto-generated
# anchor ids (`#zc99932e`): those are content hashes that churn whenever the
# page is edited, and wikiru is hand-maintained. The text is stable; the hash
# is not. Take the first `style_table` that follows the matching heading.
_SECTION_TABLE_EXPR = (
    '//*[self::h2 or self::h3 or self::h4][contains(., "{heading}")]'
    '/following::table[contains(@class, "style_table")][1]'
)

# `2021/11/15 12:00 〜 11/26 11:59` — JST. The end date routinely omits its year
# (same year as the start) and occasionally its month; the wave dash comes in
# three flavours (〜 ～ ~) because a human types it. Tolerate all of that.
_PERIOD_PATTERN = re.compile(
    r"(?P<sy>\d{4})/(?P<sm>\d{1,2})/(?P<sd>\d{1,2})\s+(?P<sh>\d{1,2}):(?P<smin>\d{2})"
    r"\s*[〜～~]\s*"
    r"(?:(?P<ey>\d{4})/)?(?P<em>\d{1,2})/(?P<ed>\d{1,2})\s+(?P<eh>\d{1,2}):(?P<emin>\d{2})"
)


@transcend
class WikiruEvents(metaclass=SingletonMeta):
    """Scraper for the wikiru event-history index.

    wikiru is a **fallback** source for event types Gametora has no structured
    surface for. It is hand-edited, so every parse is defensive: a row that
    doesn't yield a JST period is warned and skipped, never fatal (the
    warn-and-skip stance for scraped input — curated YAML is what fails loud).
    Returns raw record dicts; entity construction is Digitan's job.
    """

    def __init__(self):
        self._uc = UmaClient()
        self._tree = None

    def _index(self):
        if self._tree is None:
            self._tree = html.fromstring(
                self._uc.get(_EVENT_INDEX_URL, cache=CacheTime.INDEX)
            )
        return self._tree

    @staticmethod
    def _parse_jp_period(text: str) -> Period | None:
        """Parse a 開催期間 cell into a JST `Period`, or `None` if it doesn't.

        Infers the end year when omitted (the common case): same year as the
        start, bumped by one if that would put the end before the start (a
        New-Year-spanning run like `12/24 12:00 〜 01/04 11:59`).
        """
        match = _PERIOD_PATTERN.search(" ".join(text.replace("\xa0", " ").split()))
        if match is None:
            return None
        g = match.groupdict()
        try:
            start = datetime(
                int(g["sy"]), int(g["sm"]), int(g["sd"]),
                int(g["sh"]), int(g["smin"]), tzinfo=JST,
            )
            end_year = int(g["ey"]) if g["ey"] else int(g["sy"])
            end = datetime(
                end_year, int(g["em"]), int(g["ed"]),
                int(g["eh"]), int(g["emin"]), tzinfo=JST,
            )
        except ValueError:
            return None
        if end < start and not g["ey"]:
            end = end.replace(year=end_year + 1)  # New-Year rollover
        if end < start:
            return None
        return Period(start=start, span=end - start)

    def _section_rows(self, heading: str) -> list[dict]:
        """Rows of the table under the section whose heading contains `heading`.

        Each row is ``{"period": Period, "name": str}``. The header row (and any
        row whose 開催期間 cell doesn't parse) is skipped with a warning. An
        absent section is a hard error — a heading we asked for and didn't find
        means the page shape moved under us, which the caller wants to know.
        """
        tables = xpath_all(self._index(), _SECTION_TABLE_EXPR.format(heading=heading))
        if not tables:
            raise ValueError(f"wikiru: no '{heading}' section table on the event index")
        rows: list[dict] = []
        for tr in xpath_all(tables[0], ".//tr"):
            cells = xpath_all(tr, "./td")
            if len(cells) < 3:
                continue  # header row, or a layout row with no data
            period = self._parse_jp_period(cells[1].text_content())
            if period is None:
                logger.warning(
                    "wikiru '%s': unparseable 開催期間 %r",
                    heading,
                    cells[1].text_content().strip()[:60],
                )
                continue
            rows.append({"period": period, "name": cells[2].text_content().strip()})
        rows.sort(key=lambda r: r["period"].start)
        return rows

    def occurrences(self, heading: str, key_prefix: str) -> list[dict]:
        """Section rows as occurrence records keyed ``<key_prefix>-NNN`` by
        chronological ordinal — the shared scheme for every event type on the
        index (JP order is the stable anchor; an EN overlay or the predictor
        chain joins on this key). Each record is ``{key, period, name, references}``.

        The one generic entry point: callers pass the section heading text and a
        key prefix (e.g. ``"フジキセキのショータイム", "showtime"``). Per-type
        knowledge lives at the model layer, not here.
        """
        records: list[dict] = []
        for ordinal, row in enumerate(self._section_rows(heading), start=1):
            records.append({
                "key": f"{key_prefix}-{ordinal:03d}",
                "period": row["period"],
                "name": row["name"],
                "references": [_EVENT_INDEX_URL],
            })
        logger.info("Extracted %d %s occurrences from wikiru", len(records), key_prefix)
        return records
