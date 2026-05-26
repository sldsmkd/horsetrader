from typing import Sequence

from lxml import html

from horsetrader.core import Japlish, SingletonMeta
from horsetrader.enums import CacheTime, Sources
from horsetrader.extractors.helpers import (
    strip_affixes,
    xpath_all,
    xpath_attr,
    xpath_first,
)
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

from .character import GametoraCharacter

logger = Logger.get(__name__)

# --- CharacterIndex ----------------------------------------------------------

_GAMETORA_BASE_URL = "https://gametora.com"
_CHAR_INDEX_MAIN_BLOCK_EXPR = "//main"
_CHAR_INDEX_ICON_PREFIX = "/images/umamusume/characters/icons/chr_icon_"
_CHAR_INDEX_ICON_SUFFIX = ".png"
_CHAR_INDEX_HREF_PREFIX = "/ja/umamusume/characters/"

_CHAR_INDEX_ANCHOR_EXPR = f'.//a[starts-with(@href, "{_CHAR_INDEX_HREF_PREFIX}")]'
_CHAR_INDEX_IMG_EXPR = f'.//img[starts-with(@src, "{_CHAR_INDEX_ICON_PREFIX}") and contains(@src, "chr_icon_")]'


@transcend
class GametoraCharacters(metaclass=SingletonMeta):
    """Scraper for character list/index pages from Gametora."""

    def __init__(self):
        self._uc = UmaClient()
        self._character_scraper = GametoraCharacter()

    def characters(self) -> Sequence[dict]:
        index_url = "https://gametora.com/ja/umamusume/characters/profiles"
        _tree = html.fromstring(
            self._uc.get(index_url, chrome=True, cache=CacheTime.INDEX)
        )

        main_block = xpath_first(_tree, _CHAR_INDEX_MAIN_BLOCK_EXPR)
        if main_block is None:
            logger.error("Main block not found")
            raise ValueError("Main block not found")

        anchors = xpath_all(main_block, _CHAR_INDEX_ANCHOR_EXPR)

        if not anchors:
            logger.error("No character anchors found")
            raise ValueError("No character anchors found")

        _records: dict[str, dict] = {}

        for anchor in anchors:
            img_src = xpath_attr(anchor, _CHAR_INDEX_IMG_EXPR, "src")
            if not img_src:
                continue

            char_id = strip_affixes(
                img_src, _CHAR_INDEX_ICON_PREFIX, _CHAR_INDEX_ICON_SUFFIX
            )
            if not char_id:
                logger.warning(
                    "Could not derive character id from anchor, skipping: %s",
                    html.tostring(anchor, encoding="unicode"),
                )
                continue

            logger.debug(f"Derived character id: {char_id}")
            record = _records.setdefault(char_id, {"id": char_id})
            record["icon_url"] = f"{_GAMETORA_BASE_URL}{img_src}"

            href = xpath_attr(anchor, ".", "href")
            slug = strip_affixes(href, _CHAR_INDEX_HREF_PREFIX) if href else None
            if not slug:
                logger.warning(
                    "Could not derive character slug for id %s, skipping detail fetch",
                    char_id,
                )
                continue

            record["slug"] = slug
            logger.debug(f"Derived character slug: {slug}")

            record.update(self._character_scraper.character(record))

        logger.info(f"Extracted {len(_records)} characters from Gametora")

        out: list[dict] = []
        for record in _records.values():
            if "slug" not in record:
                continue

            correlations: dict[str, int] = {}
            if str(record.get("id", "")).isdigit():
                correlations[Sources.GAMETORA.value] = int(record["id"])

            references = [index_url]
            detail_url = record.get("source_url")
            if isinstance(detail_url, str) and detail_url:
                references.append(detail_url)

            out.append(
                {
                    "key": record["slug"],
                    "name": record.get("name", Japlish("")),
                    "quote": record.get("quote"),
                    "icon_url": record.get("icon_url"),
                    "portrait_url": record.get("portrait_url"),
                    "correlations": correlations,
                    "references": references,
                }
            )

        return out
