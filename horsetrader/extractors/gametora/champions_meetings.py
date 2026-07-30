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

from .dates import parse_date

logger = Logger.get(__name__)

# Champions Meetings live on two Gametora surfaces that share one ordinal
# keyspace (Gametora's chronological CM occurrence number, 1-based):
#
#   * the JA index renders a multi-server schedule whose `日本版` row supplies
#     the JP calendar dates.
#   * the locale-less (EN) index renders the same schedule with `JP` rows plus
#     a `<select>` cup catalogue, `<option value="N">N - Name</option>`.
#
# We join the JP periods and EN names by that ordinal. Track metadata is
# deliberately out of scope.
_CM_JA_URL = "https://gametora.com/ja/umamusume/events/champions-meeting"
_CM_EN_URL = "https://gametora.com/umamusume/events/champions-meeting"

# New multi-server rows are date-only; the alternatives retain support for the
# preceding explicit-time layouts.
_CM_JA_DATE_DIV_EXPR = (
    '//main//div[(b[normalize-space(.)="日本版"] and count(span) = 2)'
    ' or (span[contains(., "年")] and span[contains(., ":")])]'
)
_CM_EN_DATE_DIV_EXPR = (
    '//main//div[(b[normalize-space(.)="JP"] and count(span) = 2)'
    ' or (count(span) = 2 and span[contains(., ":")])]'
)
# The EN catalogue is a <select> of numbered options.
_CM_OPTION_EXPR = "//main//select/option[@value]"

_JP_DT_PATTERN = re.compile(r"(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})")
_JP_DATE_PATTERN = re.compile(r"(\d{4})年(\d{1,2})月(\d{1,2})日")
_EN_DT_PATTERN = re.compile(
    r"(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4}),?\s*(\d{1,2}):(\d{2})"
)
_EN_DATE_PATTERN = re.compile(r"(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})")
_OPTION_NAME_PATTERN = re.compile(r"^\s*\d+\s*-\s*(?P<name>.+?)\s*$")


@transcend
class GametoraChampionsMeetings(metaclass=SingletonMeta):
    """Scraper for Champions Meeting occurrences from the two Gametora index pages.

    JP periods come from the JA index; EN cup names from the locale-less index.
    Records are keyed by the shared chronological ordinal (`cm-N`).
    """

    def __init__(self):
        self._uc = UmaClient()

    @staticmethod
    def _parse_jp_period(text: str) -> Period | None:
        """Parse a JP schedule row from either Gametora locale.

        Current rows supply calendar dates only, so stamp the official
        competition boundary: 12:00 through 11:59 JST.
        """
        collapsed = " ".join(text.replace("\xa0", " ").split())
        jp_matches = _JP_DT_PATTERN.findall(collapsed)
        en_matches = _EN_DT_PATTERN.findall(collapsed)
        try:
            if len(jp_matches) >= 2:
                start, end = (
                    datetime(int(y), int(mo), int(d), int(h), int(mi), tzinfo=JST)
                    for y, mo, d, h, mi in jp_matches[:2]
                )
            elif len(en_matches) >= 2:
                start, end = (
                    parse_date(f"{d} {mo} {y}").replace(
                        hour=int(h),
                        minute=int(mi),
                    )
                    for d, mo, y, h, mi in en_matches[:2]
                )
            else:
                jp_dates = _JP_DATE_PATTERN.findall(collapsed)
                if len(jp_dates) >= 2:
                    start = datetime(
                        *(int(part) for part in jp_dates[0]),
                        hour=12,
                        tzinfo=JST,
                    )
                    end = datetime(
                        *(int(part) for part in jp_dates[1]),
                        hour=11,
                        minute=59,
                        tzinfo=JST,
                    )
                else:
                    en_dates = _EN_DATE_PATTERN.findall(collapsed)
                    if len(en_dates) < 2:
                        return None
                    start = parse_date(" ".join(en_dates[0]))
                    end = parse_date(" ".join(en_dates[1])).replace(
                        hour=11,
                        minute=59,
                    )
        except ValueError:
            return None
        if end < start:
            return None
        return Period(start=start, span=end - start)

    def _scrape_jp_periods(self) -> list[Period]:
        tree = html.fromstring(
            self._uc.get(_CM_JA_URL, chrome=True, cache=CacheTime.INDEX)
        )
        divs = xpath_all(tree, _CM_JA_DATE_DIV_EXPR)
        if not divs:
            logger.info(
                "Gametora CM: JA index has no JP rows; using locale-less index"
            )
            tree = html.fromstring(
                self._uc.get(_CM_EN_URL, chrome=True, cache=CacheTime.INDEX)
            )
            divs = xpath_all(tree, _CM_EN_DATE_DIV_EXPR)
        if not divs:
            raise ValueError("Gametora CM: no JP date blocks")
        periods: list[Period] = []
        for div in divs:
            period = self._parse_jp_period(div.text_content())
            if period is None:
                logger.warning(
                    "Gametora CM: unparseable JA date block %r",
                    div.text_content()[:80],
                )
                continue
            periods.append(period)
        if not periods:
            raise ValueError("Gametora CM: no valid JP periods extracted")
        periods.sort(key=lambda p: p.start)
        return periods

    def _scrape_en_names(self) -> dict[int, str]:
        """Ordinal → EN cup/category name from the locale-less `<select>`."""
        tree = html.fromstring(
            self._uc.get(_CM_EN_URL, chrome=True, cache=CacheTime.INDEX)
        )
        names: dict[int, str] = {}
        for opt in xpath_all(tree, _CM_OPTION_EXPR):
            raw_value = (opt.get("value") or "").strip()
            if not raw_value.isdigit():
                continue
            match = _OPTION_NAME_PATTERN.match(opt.text or "")
            if match is None:
                continue
            names[int(raw_value)] = match.group("name")
        if not names:
            logger.warning("Gametora CM: no EN names found on locale-less index")
        return names

    def champions_meetings(self) -> Sequence[dict]:
        periods = self._scrape_jp_periods()
        names = self._scrape_en_names()
        if names and len(names) != len(periods):
            logger.warning(
                "Gametora CM: %d JP periods but %d EN names — joining by ordinal anyway",
                len(periods),
                len(names),
            )

        records: list[dict] = []
        for ordinal, period in enumerate(periods, start=1):
            records.append(
                {
                    # Zero-padded to 3 (cm-001 … cm-999): the ordinal is the
                    # stable key (order never changes — global-default merely
                    # confirms it), and 50+ occurrences already exist, so a
                    # 2-digit width like scenarios would wrap. Matches the
                    # story-NNN padding convention.
                    "key": f"cm-{ordinal:03d}",
                    "ordinal": ordinal,
                    "period": period,
                    "name": names.get(ordinal),
                    "references": [_CM_JA_URL, _CM_EN_URL],
                }
            )
        logger.info("Extracted %d Champions Meetings from Gametora", len(records))
        return records
