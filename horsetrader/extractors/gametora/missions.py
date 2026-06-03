import re
from datetime import datetime
from typing import Sequence

from lxml import html

from horsetrader.core import JST, UTC, Period, SingletonMeta
from horsetrader.enums import CacheTime
from horsetrader.extractors.helpers import xpath_all, xpath_attr, xpath_first
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)

_GAMETORA_BASE_URL = "https://gametora.com"

# Limited missions are paged by year. JP history runs from launch (2021); the
# locale-less (EN/Global) history only goes back to Global launch (2025). The
# logo-image id is a shared catalogue key: EN renumbers from a low base but
# **replays JP's original ids from the start**, so EN's (low) ids line up with
# JP's *early-year* ids — the join is by id across the full JP history, not by
# same-year slice. The mission *content* (campaign + race) matches at that id.
_JP_URL_TEMPLATE = "https://gametora.com/ja/umamusume/missions/history-{year}"
_JP_START_YEAR = 2021
_EN_URL_TEMPLATE = "https://gametora.com/umamusume/missions/history-{year}"
_EN_START_YEAR = 2025

_MAIN_EXPR = "//main"
_LOGO_EXPR = './/img[contains(@src, "tex_campaign_mission_logo_")][1]'
_LOGO_ID_PATTERN = re.compile(r"tex_campaign_mission_logo_(\d+)\.png")

# Reward rows: an item icon paired with its "xN" amount.
_REWARD_ROW_EXPR = './/div[contains(@class, "missions_row__")]'
_REWARD_ITEM_IMG_EXPR = './/img[contains(@src, "/items/item_icon_")]'
_REWARD_AMOUNT_EXPR = './/div[contains(@class, "missions_row_num__")]'
_REWARD_ITEM_ID_PATTERN = re.compile(r"/items/item_icon_(\d+)\.png")
_REWARD_AMOUNT_PATTERN = re.compile(r"x(\d+)")

# JP block carries 開始日時/終了日時 and a <b> title.
_JP_BLOCK_EXPR = (
    './/div[.//img[contains(@src, "tex_campaign_mission_logo_")] '
    'and contains(., "開始日時")]'
)
_JP_TITLE_EXPR = ".//b[1]"
_JP_DATETIME_PATTERN = re.compile(r"(\d{4}年\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2})")

# EN block carries Start:/End: and a <div lang="en"><b> title.
_EN_BLOCK_EXPR = (
    './/div[.//img[contains(@src, "tex_campaign_mission_logo_")] '
    'and contains(., "Start:")]'
)
_EN_TITLE_EXPR = './/div[@lang="en"]/b'
# Gametora EN uses "Sept" (non-standard) for September; normalise before parsing.
_EN_DATETIME_PATTERN = re.compile(r"(\d{1,2}\s+\w+\s+\d{4}),\s*(\d{1,2}:\d{2})")
_EN_DATETIME_FMT = "%d %b %Y %H:%M"


def _absolute_url(path: str) -> str:
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{_GAMETORA_BASE_URL}{path}"


@transcend
class GametoraMissions(metaclass=SingletonMeta):
    """Scraper for limited missions, aggregated across the Gametora year-index
    pages.

    Two surfaces share one catalogue keyspace (the logo-image id → ``mission-NNN``):
    the JA history (launch 2021 → now) is the substrate — JP window + JP title +
    rewards; the locale-less history (2025 → now) supplies the EN title + EN
    window, joined by id. Hand-edited, high-volume page, so every block is
    defensive: a block missing its logo / title / dates is warned and skipped
    (warn-and-skip for scraped input). Returns raw record dicts.
    """

    def __init__(self):
        self._uc = UmaClient()

    @staticmethod
    def _reward_items(block) -> list[tuple[str, int]]:
        rewards: list[tuple[str, int]] = []
        for row in xpath_all(block, _REWARD_ROW_EXPR):
            id_match = _REWARD_ITEM_ID_PATTERN.search(
                xpath_attr(row, _REWARD_ITEM_IMG_EXPR, "src") or ""
            )
            if not id_match:
                continue
            amount_node = xpath_first(row, _REWARD_AMOUNT_EXPR)
            if amount_node is None:
                continue
            amount_match = _REWARD_AMOUNT_PATTERN.match(amount_node.text_content().strip())
            if not amount_match:
                continue
            rewards.append((id_match.group(1), int(amount_match.group(1))))
        return rewards

    @staticmethod
    def _parse_jp_period(block_text: str) -> Period | None:
        collapsed = " ".join(block_text.replace("\xa0", " ").split())
        matches = _JP_DATETIME_PATTERN.findall(collapsed)
        if len(matches) < 2:
            return None
        try:
            start = datetime.strptime(matches[0], "%Y年%m月%d日 %H:%M").replace(tzinfo=JST)
            end = datetime.strptime(matches[1], "%Y年%m月%d日 %H:%M").replace(tzinfo=JST)
        except ValueError:
            return None
        if end < start:
            return None
        return Period(start=start, span=end - start)

    @staticmethod
    def _parse_en_period(block_text: str) -> Period | None:
        collapsed = " ".join(block_text.replace("\xa0", " ").replace("Sept ", "Sep ").split())
        matches = _EN_DATETIME_PATTERN.findall(collapsed)
        if len(matches) < 2:
            return None
        try:
            start = datetime.strptime(f"{matches[0][0]} {matches[0][1]}", _EN_DATETIME_FMT).replace(tzinfo=UTC)
            end = datetime.strptime(f"{matches[1][0]} {matches[1][1]}", _EN_DATETIME_FMT).replace(tzinfo=UTC)
        except ValueError:
            return None
        if end < start:
            return None
        return Period(start=start, span=end - start)

    def _key(self, block) -> str | None:
        logo = xpath_attr(block, _LOGO_EXPR, "src")
        if not logo:
            return None
        id_match = _LOGO_ID_PATTERN.search(logo)
        return f"mission-{id_match.group(1)}" if id_match else None

    def _fetch_year(self, url: str, current_year: int, year: int, *, en: bool) -> list[dict]:
        """One year-index page → mission record dicts. A missing page/blocks for
        the *current* year is tolerated (not published yet); a past year is a
        hard error (the page shape moved under us)."""
        block_expr = _EN_BLOCK_EXPR if en else _JP_BLOCK_EXPR
        title_expr = _EN_TITLE_EXPR if en else _JP_TITLE_EXPR
        parse_period = self._parse_en_period if en else self._parse_jp_period
        kind = "EN" if en else "JP"
        try:
            raw = self._uc.get(url, chrome=True, cache=CacheTime.INDEX)
        except RuntimeError as exc:
            if year < current_year:
                raise
            logger.warning("%s missions page %d not yet available: %s", kind, year, exc)
            return []

        main = xpath_first(html.fromstring(raw), _MAIN_EXPR)
        blocks = xpath_all(main, block_expr) if main is not None else []
        if not blocks:
            if year < current_year:
                raise ValueError(f"{kind} missions: no blocks on {url}")
            logger.warning("%s missions page %d has no blocks yet", kind, year)
            return []

        records: list[dict] = []
        for block in blocks:
            key = self._key(block)
            if key is None:
                logger.warning("%s mission block missing logo id, skipping", kind)
                continue
            title_node = xpath_first(block, title_expr)
            title = " ".join(title_node.text_content().split()) if title_node is not None else ""
            if not title:
                logger.warning("%s mission %s missing title, skipping", kind, key)
                continue
            period = parse_period(block.text_content())
            if period is None:
                logger.warning("%s mission %s unparseable dates, skipping", kind, key)
                continue
            record = {
                "key": key,
                "title": title,
                "period": period,
                "thumb_url": _absolute_url(xpath_attr(block, _LOGO_EXPR, "src") or ""),
                "references": [url],
            }
            if not en:
                record["reward_items"] = self._reward_items(block)
            records.append(record)
        logger.info("Extracted %d %s missions from %s", len(records), kind, url)
        return records

    def _aggregate(self, template: str, start_year: int, *, en: bool) -> list[dict]:
        current_year = datetime.now().year
        out: list[dict] = []
        for year in range(start_year, current_year + 1):
            out.extend(
                self._fetch_year(template.format(year=year), current_year, year, en=en)
            )
        return out

    def missions(self) -> Sequence[dict]:
        """JP mission catalogue (substrate): JP title + JST window + reward items,
        keyed ``mission-NNN`` by logo id, across all JP history years."""
        return self._aggregate(_JP_URL_TEMPLATE, _JP_START_YEAR, en=False)

    def missions_en(self) -> Sequence[dict]:
        """EN mission overlay: EN title + UTC window, keyed by the shared
        ``mission-NNN`` logo id, across Global history years (2025 →)."""
        return self._aggregate(_EN_URL_TEMPLATE, _EN_START_YEAR, en=True)
