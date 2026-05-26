from lxml import html

from horsetrader.core import Japlish, SingletonMeta
from horsetrader.enums import CacheTime
from horsetrader.extractors.helpers import xpath_attr, xpath_first
from horsetrader.info import Logger
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)

_CHAR_INDEX_ICON_SUFFIX = ".png"

_CHAR_OVERVIEW_BLOCK_EXPR = (
    '//div[contains(@class, "characters_infobox_top__") and '
    './/div[contains(@class, "characters_infobox_character_name__")] and '
    './/img[contains(@src, "/umamusume/characters/profile/")]]'
)
_CHAR_OVERVIEW_NAME_EXPR = (
    './/div[contains(@class, "characters_infobox_character_name__")][1]'
)
_CHAR_OVERVIEW_IMAGE_EXPR = (
    './/img[contains(@src, "/umamusume/characters/profile/")][1]'
)
_CHAR_OVERVIEW_TAGLINE_EXPR = ".//i[1]"
_CHAR_QUOTE_ICON_PREFIX = "/images/umamusume/characters/icons/chr_icon_"


class GametoraCharacter(metaclass=SingletonMeta):
    """Scraper for individual character detail pages from Gametora."""

    def __init__(self):
        self._uc = UmaClient()

    def _overview(self, tree: html.HtmlElement) -> dict:
        _overview_block = xpath_first(tree, _CHAR_OVERVIEW_BLOCK_EXPR)
        if _overview_block is None:
            return {}

        _name = xpath_first(_overview_block, _CHAR_OVERVIEW_NAME_EXPR)
        _tagline = xpath_first(_overview_block, _CHAR_OVERVIEW_TAGLINE_EXPR)

        return {
            "name": _name.text_content().strip() if _name is not None else None,
            "tagline": (
                _tagline.text_content().strip() if _tagline is not None else None
            ),
            "profile_image_url": xpath_attr(
                _overview_block,
                _CHAR_OVERVIEW_IMAGE_EXPR,
                "src",
            ),
        }

    def _pullquote(self, tree: html.HtmlElement, char_id: str) -> Japlish | None:
        _icon_src = f"{_CHAR_QUOTE_ICON_PREFIX}{char_id}{_CHAR_INDEX_ICON_SUFFIX}"
        _quote_text_predicate = (
            "string-length(normalize-space(.)) > 8 and "
            'not(contains(normalize-space(.), "プロフィール"))'
        )
        _quote_expr = (
            f'//div[.//img[contains(@src, "{_icon_src}")] and '
            f".//div/span[{_quote_text_predicate}]]"
            f"//div/span[{_quote_text_predicate}][1]"
        )
        _quote = xpath_first(tree, _quote_expr)

        if _quote is None:
            _icon = xpath_first(tree, f'//img[contains(@src, "{_icon_src}")][1]')
            if _icon is not None:
                _quote = xpath_first(
                    _icon,
                    f"../../following-sibling::div[1]//span[{_quote_text_predicate}][1]",
                )

        if _quote is None:
            return None

        _text = _quote.text_content()
        if not _text:
            return None
        return Japlish(_text)

    def _biography(self) -> dict:
        return {}

    def character(self, record: dict) -> dict:
        char_id = record.get("id")
        slug = record.get("slug")
        if not isinstance(char_id, str) or not char_id:
            raise ValueError("Character record must include a non-empty string 'id'")
        if not isinstance(slug, str) or not slug:
            raise ValueError("Character record must include a non-empty string 'slug'")

        detail_url = f"https://gametora.com/ja/umamusume/characters/{slug}"
        _raw = self._uc.get(detail_url, chrome=True, cache=CacheTime.LEAF)
        _tree = html.fromstring(_raw)

        _overview = self._overview(_tree)
        _name = _overview.get("name") or record.get("name") or "Unknown"
        _portrait_url = _overview.get("profile_image_url")
        _tagline = _overview.get("tagline")
        _en_quote = self._pullquote(_tree, char_id)

        if _tagline:
            _quote = Japlish(_tagline)
            if _en_quote is not None and _en_quote.encoding.value == "en":
                _quote.en = str(_en_quote)
        else:
            _quote = _en_quote

        logger.info(f"Fetching character details for {char_id} from Gametora")

        return {
            "name": Japlish(_name),
            "quote": _quote,
            "source_url": detail_url,
            "portrait_url": _portrait_url,
        }
