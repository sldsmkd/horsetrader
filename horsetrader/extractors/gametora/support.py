import re
from datetime import datetime

from lxml import html

from horsetrader.core import JST, Japlish, Period, SingletonMeta
from horsetrader.enums import CacheTime
from horsetrader.extractors.helpers import xpath_first
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)

_SUPPORT_PAGE_URL_PREFIX = "https://gametora.com/ja/umamusume/supports/"
_SUPPORT_PAGE_EN_URL_PREFIX = "https://gametora.com/umamusume/supports/"
_SUPPORT_RELEASE_DATE_PATTERN = re.compile(
    r"実装日\s*(?P<year>\d{4})年(?P<month>\d{1,2})月(?P<day>\d{1,2})日"
)
_SUPPORT_CARD_TITLE_PATTERN = re.compile(r"^\[(?P<title>.+)\]$")
_SUPPORT_INFOBOX_ROWS_EXPR = '//div[contains(@class, "supports_infobox")]'

# First supports_infobox_centered_text__ block contains title + character name.
_SUPPORT_NAME_BLOCK_EXPR = (
    '(//div[contains(@class, "supports_infobox_centered_text__")])[1]'
)
_SUPPORT_CARD_TITLE_EXPR = f"{_SUPPORT_NAME_BLOCK_EXPR}/div[1]"
_SUPPORT_CHARACTER_NAME_EXPR = (
    f'{_SUPPORT_NAME_BLOCK_EXPR}/div[contains(@class, "supports_mobile_flex_center__")]'
)


@transcend
class GametoraSupport(metaclass=SingletonMeta):
    """Scraper for individual support card detail pages from Gametora."""

    def __init__(self):
        self._uc = UmaClient()

    @staticmethod
    def _extract_card_title(tree: html.HtmlElement) -> str | None:
        node = xpath_first(tree, _SUPPORT_CARD_TITLE_EXPR)
        if node is None:
            return None
        match = _SUPPORT_CARD_TITLE_PATTERN.match(node.text_content().strip())
        return match.group("title") if match else None

    @staticmethod
    def _extract_character_name(tree: html.HtmlElement) -> str | None:
        node = xpath_first(tree, _SUPPORT_CHARACTER_NAME_EXPR)
        if node is None:
            return None
        return node.text_content().strip() or None

    @staticmethod
    def _extract_release(tree: html.HtmlElement) -> Period:
        for row in tree.xpath(_SUPPORT_INFOBOX_ROWS_EXPR):
            text = row.text_content()
            if "実装日" not in text:
                continue
            match = _SUPPORT_RELEASE_DATE_PATTERN.search(text)
            if match:
                return Period(
                    datetime(
                        year=int(match.group("year")),
                        month=int(match.group("month")),
                        day=int(match.group("day")),
                        hour=12,
                        tzinfo=JST,
                    )
                )

        # Fallback: some support pages render the date outside the infobox.
        main_nodes = tree.xpath("//main")
        if main_nodes:
            main_text = " ".join(main_nodes[0].text_content().split())
            match = _SUPPORT_RELEASE_DATE_PATTERN.search(main_text)
            if match:
                return Period(
                    datetime(
                        year=int(match.group("year")),
                        month=int(match.group("month")),
                        day=int(match.group("day")),
                        hour=12,
                        tzinfo=JST,
                    )
                )

        raise ValueError("Could not extract release date from support page")

    def support(self, record: dict) -> dict:
        slug = record.get("slug")
        if not isinstance(slug, str) or not slug:
            raise ValueError("Support record must include a non-empty string 'slug'")

        source_url = f"{_SUPPORT_PAGE_URL_PREFIX}{slug}"
        tree = html.fromstring(
            self._uc.get(source_url, chrome=True, cache=CacheTime.LEAF)
        )

        # EN page fetch for bilingual title + character name: umapyoi API covers
        # character/trainee name translation but has no equivalent for support cards.
        en_url = f"{_SUPPORT_PAGE_EN_URL_PREFIX}{slug}"
        en_tree = html.fromstring(
            self._uc.get(en_url, chrome=True, cache=CacheTime.LEAF)
        )

        jp_title = self._extract_card_title(tree)
        en_title = self._extract_card_title(en_tree)
        if jp_title or en_title:
            title = Japlish(jp_title or en_title or "")
            if en_title:
                title.en = en_title
        else:
            title = None

        jp_char_name = self._extract_character_name(tree)
        en_char_name = self._extract_character_name(en_tree)
        if jp_char_name or en_char_name:
            character_name = Japlish(jp_char_name or en_char_name or "")
            if en_char_name:
                character_name.en = en_char_name
        else:
            character_name = None

        logger.info(f"Fetching support details for {slug} from Gametora")

        return {
            "source_url": source_url,
            "release": self._extract_release(tree),
            "title": title,
            "character_name": character_name,
        }
