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

# Champions Meetings live on two Gametora surfaces that share one ordinal
# keyspace (Gametora's chronological CM occurrence number, 1-based):
#
#   * the JA index renders the JP-server schedule (dates + tracks) in the old
#     `YYYY年M月D日 H:MM` layout — our source for the JP `Period`.
#   * the locale-less (EN) index renders a `<select>` cup catalogue,
#     `<option value="N">N - Name</option>` — our source for the EN name.
#
# We join the two by that ordinal. Gametora is mid-migration to a globally
# aware layout, so both surfaces may shift under us; we scrape what is live
# today and fail loud (or warn-and-degrade on the optional name) when the
# shapes disagree. Track metadata on the JA page is deliberately out of scope.
_CM_JA_URL = "https://gametora.com/ja/umamusume/events/champions-meeting"
_CM_EN_URL = "https://gametora.com/umamusume/events/champions-meeting"

# A date div carries two <span>s: one with the year kanji, one with the time.
_CM_DATE_DIV_EXPR = '//main//div[span[contains(., "年")] and span[contains(., ":")]]'
# The EN catalogue is a <select> of numbered options.
_CM_OPTION_EXPR = "//main//select/option[@value]"

_JP_DT_PATTERN = re.compile(r"(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})")
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
        """Parse a JA date div ("2021年5月14日 4:00 – 2021年5月20日 3:59").

        Stamps the JST instant Gametora actually lists (CM rounds open at the
        in-game hour, not the generic 12:00 banner drop), so it is parsed
        here rather than via the prose `dates.parse_period` helper.
        """
        matches = _JP_DT_PATTERN.findall(" ".join(text.replace("\xa0", " ").split()))
        if len(matches) < 2:
            return None
        try:
            start, end = (
                datetime(int(y), int(mo), int(d), int(h), int(mi), tzinfo=JST)
                for y, mo, d, h, mi in matches[:2]
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
        divs = xpath_all(tree, _CM_DATE_DIV_EXPR)
        if not divs:
            raise ValueError("Gametora CM: no date blocks on JA index page")
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
