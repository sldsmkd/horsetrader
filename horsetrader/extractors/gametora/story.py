import re
from datetime import datetime
from typing import Sequence

from lxml import html

from horsetrader.core import JST, Period, SingletonMeta
from horsetrader.enums import CacheTime
from horsetrader.extractors.helpers import strip_affixes, xpath_all, xpath_attr, xpath_first
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)

_GAMETORA_BASE_URL = "https://gametora.com"
STORY_INDEX_URL = "https://gametora.com/ja/umamusume/events/story-events"
_STORY_INDEX_MAIN_EXPR = "//main"
_STORY_HREF_PREFIX = "/ja/umamusume/events/"
_STORY_HREF_ANCHOR_PREFIX = f"{_STORY_HREF_PREFIX}story-event-"
_STORY_IMAGE_ANCHOR_EXPR = (
    f'.//a[starts-with(@href, "{_STORY_HREF_ANCHOR_PREFIX}") and '
    './/img[contains(@src, "/umamusume/story_events/thumb_title/")]]'
)
_STORY_IMAGE_EXPR = './/img[contains(@src, "/umamusume/story_events/thumb_title/")][1]'
_STORY_KEY_PATTERN = re.compile(r"^story-event-\d+$")
_HERO_URL_PATTERN = re.compile(
    r"/umamusume/story_events/thumb_title/(?:ja|en)/(\d+)\.png$"
)

# Detail page
_STORY_PAGE_URL_PREFIX_JA = f"{_GAMETORA_BASE_URL}/ja/umamusume/events/"
_STORY_PAGE_URL_PREFIX_EN = f"{_GAMETORA_BASE_URL}/umamusume/events/"
_STORY_MAIN_EXPR = "//main"
_STORY_TITLE_EXPR = ".//h1[1]"
_STORY_EVENT_BLOCK_EXPR = (
    './/div[.//img[contains(@src, "/umamusume/story_events/icon/")] and '
    './/span[contains(normalize-space(.), "年")]][1]'
)
_STORY_ICON_EXPR = './/img[contains(@src, "/umamusume/story_events/icon/")][1]'
_STORY_TRAINEES_BLOCK_EXPR = './/div[div[normalize-space(text())="4⭐"]][1]'
_STORY_TRAINEE_LINKS_EXPR = './/a[contains(@href, "/umamusume/characters/")]'
_STORY_WELFARE_SECTION_EXPR = './/div[h2[normalize-space(text())="イベントサポートカード"]]'
_STORY_SUPPORT_LINKS_EXPR = './/a[contains(@href, "/umamusume/supports/")]'
_JP_DATETIME_PATTERN = re.compile(r"(\d{4}年\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2})")
_EN_TITLE_SUFFIX_PATTERN = re.compile(r"\s+Story\s+Event\s*$", re.IGNORECASE)


def _absolute_url(path_or_url: str | None) -> str | None:
    if not path_or_url:
        return None
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        return path_or_url
    return f"{_GAMETORA_BASE_URL}{path_or_url}"


def _hero_url_from_thumb(thumb_url: str | None) -> str | None:
    if not thumb_url:
        return None
    match = _HERO_URL_PATTERN.search(thumb_url)
    if match is None:
        return None
    return f"https://media.gametora.com/umamusume/story_events/hero/{match.group(1)}.png"


@transcend
class GametoraStory(metaclass=SingletonMeta):
    """Scraper for individual story-event detail pages on Gametora."""

    def __init__(self):
        self._uc = UmaClient()

    @staticmethod
    def _extract_slugs(block, link_expr: str) -> list[str]:
        if block is None:
            return []
        seen: set[str] = set()
        slugs: list[str] = []
        for a in xpath_all(block, link_expr):
            href = xpath_attr(a, ".", "href") or ""
            slug = href.rsplit("/", 1)[-1] if "/" in href else ""
            if slug and slug not in seen:
                seen.add(slug)
                slugs.append(slug)
        return slugs

    @staticmethod
    def _parse_period(block_text: str) -> Period:
        collapsed = " ".join(block_text.replace("\xa0", " ").split())
        matches = _JP_DATETIME_PATTERN.findall(collapsed)
        if len(matches) < 2:
            raise ValueError("Could not extract story date range from detail page")
        start = datetime.strptime(matches[0], "%Y年%m月%d日 %H:%M").replace(tzinfo=JST)
        end = datetime.strptime(matches[1], "%Y年%m月%d日 %H:%M").replace(tzinfo=JST)
        if end < start:
            raise ValueError("Story date range end is before start")
        return Period(start=start, span=end - start)

    def story(self, key: str) -> dict:
        source_url_ja = f"{_STORY_PAGE_URL_PREFIX_JA}{key}"
        tree_ja = html.fromstring(
            self._uc.get(source_url_ja, chrome=True, cache=CacheTime.LEAF)
        )
        main_ja = xpath_first(tree_ja, _STORY_MAIN_EXPR)
        if main_ja is None:
            raise ValueError(f"Main block not found on story detail page: {key}")

        event_block = xpath_first(main_ja, _STORY_EVENT_BLOCK_EXPR)
        if event_block is None:
            raise ValueError(f"Event date block not found on story detail page: {key}")
        period = self._parse_period(event_block.text_content())
        icon_url = _absolute_url(xpath_attr(event_block, _STORY_ICON_EXPR, "src"))

        trainee_ids = self._extract_slugs(
            xpath_first(main_ja, _STORY_TRAINEES_BLOCK_EXPR),
            _STORY_TRAINEE_LINKS_EXPR,
        )
        support_ids = self._extract_slugs(
            xpath_first(main_ja, _STORY_WELFARE_SECTION_EXPR),
            _STORY_SUPPORT_LINKS_EXPR,
        )

        source_url_en = f"{_STORY_PAGE_URL_PREFIX_EN}{key}"
        tree_en = html.fromstring(
            self._uc.get(source_url_en, chrome=True, cache=CacheTime.LEAF)
        )
        main_en = xpath_first(tree_en, _STORY_MAIN_EXPR)
        title_en: str | None = None
        if main_en is not None:
            title_node = xpath_first(main_en, _STORY_TITLE_EXPR)
            if title_node is not None:
                raw = " ".join(title_node.text_content().split())
                cleaned = _EN_TITLE_SUFFIX_PATTERN.sub("", raw).strip()
                title_en = cleaned or None

        logger.info("Fetched story details for %s from Gametora", key)
        return {
            "period": period,
            "title_en": title_en,
            "icon_url": icon_url,
            "trainee_ids": trainee_ids,
            "support_ids": support_ids,
            "source_url_ja": source_url_ja,
            "source_url_en": source_url_en,
        }


@transcend
class GametoraStories(metaclass=SingletonMeta):
    """Scraper for the Story event index on Gametora."""

    def __init__(self):
        self._uc = UmaClient()
        self._story_scraper = GametoraStory()

    def stories(self) -> Sequence[dict]:
        tree = html.fromstring(
            self._uc.get(STORY_INDEX_URL, chrome=True, cache=CacheTime.INDEX)
        )

        main = xpath_first(tree, _STORY_INDEX_MAIN_EXPR)
        if main is None:
            raise ValueError("Gametora stories: main block not found")

        anchors = xpath_all(main, _STORY_IMAGE_ANCHOR_EXPR)
        if not anchors:
            raise ValueError("Gametora stories: no story anchors found")

        records_by_key: dict[str, dict] = {}
        for anchor in anchors:
            href = xpath_attr(anchor, ".", "href")
            if not href:
                continue

            key = strip_affixes(href, _STORY_HREF_PREFIX)
            if not key or _STORY_KEY_PATTERN.match(key) is None:
                continue

            title_jp = ""
            image_alt = xpath_attr(anchor, _STORY_IMAGE_EXPR, "alt")
            if image_alt:
                title_jp = " ".join(image_alt.split())
            if not title_jp and anchor.getparent() is not None:
                title_node = xpath_first(
                    anchor.getparent(),
                    f'.//a[@href="{href}" and string-length(normalize-space(text())) > 0][1]',
                )
                if title_node is not None:
                    title_jp = " ".join(title_node.text_content().split())
            if not title_jp:
                logger.warning("Story title missing for key %s; skipping", key)
                continue

            thumb_url = _absolute_url(xpath_attr(anchor, _STORY_IMAGE_EXPR, "src"))
            art_url = _hero_url_from_thumb(thumb_url)

            existing = records_by_key.get(key)
            if existing is not None and existing.get("art_url") and not art_url:
                continue

            records_by_key[key] = {
                "key": key,
                "title_jp": title_jp,
                "art_url": art_url,
            }

        records = sorted(
            records_by_key.values(),
            key=lambda r: int(r["key"].rsplit("-", 1)[1]),
        )
        if not records:
            raise ValueError("Gametora stories: no records extracted")

        out = []
        for record in records:
            key = record["key"]
            try:
                detail = self._story_scraper.story(key)
            except Exception as exc:
                logger.warning("Skipping story %s: %s", key, exc)
                continue
            source_url_ja = detail["source_url_ja"]
            source_url_en = detail["source_url_en"]
            out.append({
                "key": key,
                "period": detail["period"],
                "title_jp": record["title_jp"],
                "title_en": detail["title_en"],
                "art_url": record["art_url"],
                "icon_url": detail["icon_url"],
                "trainee_ids": detail["trainee_ids"],
                "support_ids": detail["support_ids"],
                "references": [STORY_INDEX_URL, source_url_ja, source_url_en],
            })

        logger.info("Extracted %s stories from Gametora", len(out))
        return out
