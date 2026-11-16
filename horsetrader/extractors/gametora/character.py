from lxml import html

from horsetrader.core import Japlish, SingletonMeta
from horsetrader.enums import CacheTime
from horsetrader.extractors.helpers import xpath_first
from horsetrader.info import Logger
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)


# The detail-page header (2026 redesign): a <section> holding the render, a heading
# (name <div> + optional tagline <i>) and a facts list of <dl><dt>label</dt><dd>…
# Class names are hashed styled-components (`sc-8a147672-N`) that churn per build,
# so everything anchors on structure: the heading is the sibling just before the
# facts container. Taglines are absent for background characters.
_CHAR_OVERVIEW_BLOCK_EXPR = "(//main//section[.//dl[dt]])[1]"
_CHAR_OVERVIEW_HEADING_EXPR = ".//div[dl][1]/preceding-sibling::div[1]"
_CHAR_OVERVIEW_NAME_EXPR = "./div[1]"
_CHAR_OVERVIEW_TAGLINE_EXPR = "./i[1]"
# 欧字名 = the official romanised name; present for every character, including the
# background ones Umapyoi doesn't carry.
_CHAR_OVERVIEW_ROMAJI_EXPR = './/dl[dt[normalize-space(.)="欧字名"]]/dd[1]'

# Profile portraits are 512px busts on the media CDN, keyed by character id. Built
# from the id rather than scraped: the detail page's markup churns (the 2026
# redesign dropped the portrait link and shows the gym outfit by default), the CDN
# paths do not. First match wins:
#   1. `portrait/profile/{id}_000002` — school uniform, the art the planner has
#      always shown (pixel-equivalent to the legacy file).
#   2. `portrait/profile/{id}_000001` — gym outfit; new characters get this first.
#   3. `profile/{id}` — the legacy path. Frozen (no new characters), but the only
#      home of the staff NPCs' portraits (Tazuna, Yayoi, …) that the site uses.
# Characters with none of these (most background NPCs) stay portrait-less.
_PORTRAIT_URL_TEMPLATES = (
    "https://media.gametora.com/umamusume/characters/portrait/profile/{id}_000002.png",
    "https://media.gametora.com/umamusume/characters/portrait/profile/{id}_000001.png",
    "https://media.gametora.com/umamusume/characters/profile/{id}.png",
)


class GametoraCharacter(metaclass=SingletonMeta):
    """Scraper for individual character detail pages from Gametora."""

    def __init__(self):
        self._uc = UmaClient()

    def _overview(self, tree: html.HtmlElement) -> dict:
        _overview_block = xpath_first(tree, _CHAR_OVERVIEW_BLOCK_EXPR)
        if _overview_block is None:
            return {}

        _heading = xpath_first(_overview_block, _CHAR_OVERVIEW_HEADING_EXPR)
        _name = xpath_first(_heading, _CHAR_OVERVIEW_NAME_EXPR) if _heading is not None else None
        _tagline = xpath_first(_heading, _CHAR_OVERVIEW_TAGLINE_EXPR) if _heading is not None else None
        _romaji = xpath_first(_overview_block, _CHAR_OVERVIEW_ROMAJI_EXPR)

        return {
            "name": _name.text_content().strip() if _name is not None else None,
            "tagline": (
                _tagline.text_content().strip() if _tagline is not None else None
            ),
            "romaji": _romaji.text_content().strip() if _romaji is not None else None,
        }

    def _portrait_url(self, char_id: str) -> str | None:
        """The first profile-portrait path the CDN actually serves, else None."""
        for template in _PORTRAIT_URL_TEMPLATES:
            url = template.format(id=char_id)
            if self._uc.try_get(url) is not None:
                return url
        return None

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
        _romaji = _overview.get("romaji")
        _portrait_url = self._portrait_url(char_id)
        _tagline = _overview.get("tagline")
        # The header tagline is the page's only quote (the 2026 redesign dropped the
        # profile speech bubble; the character icon now also sits in the pedigree
        # tree, so an icon-anchored heuristic would read sire names). JP only — the
        # Umapyoi enricher backfills the EN side, or supplies the whole quote for
        # characters without a tagline.
        _quote = Japlish(_tagline) if _tagline else None

        logger.info(f"Fetching character details for {char_id} from Gametora")

        # JP name with the official romanisation as its EN side. Umapyoi's name
        # (source of truth) replaces this wholesale where it has the character.
        _name_jl = Japlish(_name)
        if _romaji and _name_jl.encoding.value == "jp":
            _name_jl.en = _romaji

        return {
            "name": _name_jl,
            "quote": _quote,
            "source_url": detail_url,
            "portrait_url": _portrait_url,
        }
