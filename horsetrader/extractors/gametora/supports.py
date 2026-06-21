import re
from typing import Sequence

from lxml import html

from horsetrader.core import SingletonMeta
from horsetrader.enums import CacheTime, Sources, SupportType
from horsetrader.extractors.helpers import (
    strip_affixes,
    xpath_all,
    xpath_attr,
    xpath_first,
)
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

from .support import GametoraSupport

logger = Logger.get(__name__)

_GAMETORA_BASE_URL = "https://gametora.com"
_GAMETORA_MEDIA_URL = "https://media.gametora.com"
_SUPPORT_INDEX_URL = "https://gametora.com/ja/umamusume/supports"
_SUPPORT_INDEX_MAIN_BLOCK_EXPR = "//main"
_SUPPORT_HREF_PREFIX = "/ja/umamusume/supports/"
_SUPPORT_ANCHOR_EXPR = f'.//a[starts-with(@href, "{_SUPPORT_HREF_PREFIX}")]'
_SUPPORT_TYPE_ICON_PREFIX = "/images/umamusume/icons/utx_ico_obtain_"
_SUPPORT_TYPE_ICON_SUFFIX = ".png"
_SUPPORT_SLUG_PATTERN = re.compile(r"^(?P<support_id>\d+)-(?P<character_key>.+)$")

_ICON_TO_SUPPORT_TYPE = {
    "00": SupportType.SPEED,
    "01": SupportType.STAMINA,
    "02": SupportType.POWER,
    "03": SupportType.GUTS,
    "04": SupportType.WIT,
    "05": SupportType.PAL,
    "06": SupportType.GROUP,
}


@transcend
class GametoraSupports(metaclass=SingletonMeta):
    """Scraper for support card entries listed on the Gametora support index."""

    def __init__(self):
        self._uc = UmaClient()
        self._support_scraper = GametoraSupport()

    @staticmethod
    def _parse_slug(slug: str) -> tuple[int, str] | None:
        match = _SUPPORT_SLUG_PATTERN.match(slug)
        if match is None:
            return None
        support_id = match.group("support_id")
        if not support_id.isdigit():
            return None
        return int(support_id), match.group("character_key")

    @staticmethod
    def _support_type_from_anchor(anchor) -> SupportType:
        icon_srcs = anchor.xpath(
            f'.//img[starts-with(@src, "{_SUPPORT_TYPE_ICON_PREFIX}")]/@src'
        )
        for icon_src in icon_srcs:
            icon_key = strip_affixes(
                icon_src,
                _SUPPORT_TYPE_ICON_PREFIX,
                _SUPPORT_TYPE_ICON_SUFFIX,
            )
            if icon_key is None:
                continue
            support_type = _ICON_TO_SUPPORT_TYPE.get(icon_key)
            if support_type is not None:
                return support_type
        raise ValueError("Could not derive support type from Gametora index anchor")

    def supports(self) -> Sequence[dict]:
        tree = html.fromstring(
            self._uc.get(_SUPPORT_INDEX_URL, chrome=True, cache=CacheTime.INDEX)
        )

        main_block = xpath_first(tree, _SUPPORT_INDEX_MAIN_BLOCK_EXPR)
        if main_block is None:
            logger.error("Main block not found")
            raise ValueError("Main block not found")

        anchors = xpath_all(main_block, _SUPPORT_ANCHOR_EXPR)
        if not anchors:
            logger.error("No support anchors found")
            raise ValueError("No support anchors found")

        records: list[dict] = []
        for anchor in anchors:
            href = xpath_attr(anchor, ".", "href")
            if not href:
                continue

            slug = strip_affixes(href, _SUPPORT_HREF_PREFIX)
            if not slug:
                continue

            parsed = self._parse_slug(slug)
            if parsed is None:
                continue
            support_id, character_key = parsed
            support_type = self._support_type_from_anchor(anchor)

            record: dict = {
                "slug": slug,
                "support_id": support_id,
                "character_key": (
                    character_key if support_type != SupportType.GROUP else None
                ),
                "support_type": support_type,
                "thumbnail_url": (
                    f"{_GAMETORA_BASE_URL}/images/umamusume/supports/"
                    f"support_card_s_{support_id}.png"
                ),
                "art_url": (
                    f"{_GAMETORA_MEDIA_URL}/umamusume/supports/full/{support_id}.png"
                ),
            }

            record.update(self._support_scraper.support(record))
            records.append(record)

        logger.info(f"Extracted {len(records)} supports from Gametora")

        out: list[dict] = []
        for record in records:
            slug = record["slug"]
            support_id = record["support_id"]

            correlations: dict[str, int] = {
                Sources.GAMETORA.value: support_id,
            }

            references = [_SUPPORT_INDEX_URL]
            detail_url = record.get("source_url")
            if isinstance(detail_url, str) and detail_url:
                references.append(detail_url)

            out.append(
                {
                    "key": slug,
                    "support_id": support_id,
                    "character_key": record["character_key"],
                    "character_name": record.get("character_name"),
                    "support_type": record["support_type"],
                    "title": record.get("title"),
                    "release": record["release"],
                    "thumbnail_url": record["thumbnail_url"],
                    "art_url": record["art_url"],
                    # Canonical reader-facing deep-link (Gametora EN page), reported
                    # by the detail scraper — not sniffed back out of `references`.
                    "source": record.get("source"),
                    "correlations": correlations,
                    "references": references,
                }
            )

        return out
