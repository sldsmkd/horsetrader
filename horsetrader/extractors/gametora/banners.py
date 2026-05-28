import re
from typing import Sequence

from lxml import html

from horsetrader.core import SingletonMeta
from horsetrader.enums import BannerType, CacheTime, Sources
from horsetrader.extractors.helpers import xpath_all, xpath_attr, xpath_first
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

from .dates import parse_period

logger = Logger.get(__name__)

_GAMETORA_BASE_URL = "https://gametora.com"
BANNER_INDEX_URL = (
    "https://gametora.com/umamusume/gacha/history?server=ja&year=all&type=all"
)
_BANNER_MAIN_EXPR = "//main"
_BANNER_DIV_EXPR = (
    './/div[@id and .//img[contains(@src, "/images/umamusume/gacha/img_bnr_gacha_")]]'
)
_BANNER_TYPE_EXPR = (
    './/div[normalize-space(text())="Support Card Gacha"'
    ' or normalize-space(text())="Character Gacha"][1]'
)
_BANNER_IMG_EXPR = './/img[contains(@src, "/images/umamusume/gacha/img_bnr_gacha_")][1]'
_PICKUP_ROW_EXPR = ".//ul//li"
_PICKUP_NAME_EXPR = './/span[contains(@class, "gacha_link_alt")][1]'
_DESCRIPTOR_PATTERN = re.compile(r"^(?P<name>.+?)\s*\((?P<descriptor>[^)]+)\)\s*$")
_SUPPORT_DESCRIPTOR_PATTERN = re.compile(
    r"^(?P<rarity>SSR|SR|R)\s+(?P<type>Speed|Stamina|Power|Guts|Wit|Pal|Group|Friend)$",
    re.IGNORECASE,
)


def parse_pickups(node: html.HtmlElement) -> list[dict]:
    """Extract pickup entries from a banner node.

    Returns dicts with ``name``, ``descriptor``, ``is_new``,
    ``support_rarity``, and ``support_type``. The ``name`` is the bare
    character/card name with the descriptor stripped out.
    """
    pickups: list[dict] = []
    for row in xpath_all(node, _PICKUP_ROW_EXPR):
        name_node = xpath_first(row, _PICKUP_NAME_EXPR)
        if name_node is None:
            continue
        raw_name = " ".join(name_node.text_content().split())
        if not raw_name:
            continue

        is_new = bool(re.search(r"\bnew\b", row.text_content(), re.IGNORECASE))

        name = raw_name
        descriptor: str | None = None
        support_rarity: str | None = None
        support_type: str | None = None

        m = _DESCRIPTOR_PATTERN.match(raw_name)
        if m is not None:
            name = m.group("name").strip()
            descriptor = m.group("descriptor").strip()
            if descriptor is not None:
                sm = _SUPPORT_DESCRIPTOR_PATTERN.match(descriptor)
                if sm is not None:
                    support_rarity = sm.group("rarity").upper()
                    support_type = sm.group("type").lower()

        pickups.append(
            {
                "name": name,
                "descriptor": descriptor,
                "is_new": is_new,
                "support_rarity": support_rarity,
                "support_type": support_type,
            }
        )
    return pickups


@transcend
class GametoraBanners(metaclass=SingletonMeta):
    """Scraper for the JP gacha banner history index on Gametora."""

    def __init__(self):
        self._uc = UmaClient()

    def banners(self) -> Sequence[dict]:
        tree = html.fromstring(
            self._uc.get(BANNER_INDEX_URL, chrome=True, cache=CacheTime.INDEX)
        )

        main = xpath_first(tree, _BANNER_MAIN_EXPR)
        if main is None:
            raise ValueError("Gametora banners: main block not found")

        nodes = xpath_all(main, _BANNER_DIV_EXPR)
        if not nodes:
            raise ValueError("Gametora banners: no banner nodes found")

        records: list[dict] = []
        for node in nodes:
            raw_id = node.get("id", "").strip()
            if not raw_id.isdigit():
                continue
            banner_id = int(raw_id)

            type_node = xpath_first(node, _BANNER_TYPE_EXPR)
            if type_node is None:
                continue
            kind = " ".join(type_node.text_content().split())
            if kind == "Support Card Gacha":
                banner_type = BannerType.SUPPORT
            elif kind == "Character Gacha":
                banner_type = BannerType.TRAINEE
            else:
                continue

            try:
                period = parse_period(node.text_content())
            except ValueError as exc:
                logger.warning("Skipping banner %s: %s", banner_id, exc)
                continue

            image_path = xpath_attr(node, _BANNER_IMG_EXPR, "src")
            if not image_path:
                logger.warning("Skipping banner %s: missing image path", banner_id)
                continue
            image_url = (
                image_path
                if image_path.startswith("http")
                else f"{_GAMETORA_BASE_URL}{image_path}"
            )

            records.append(
                {
                    "key": f"{banner_id}-banner",
                    "banner_id": banner_id,
                    "period": period,
                    "banner_type": banner_type,
                    "image_url": image_url,
                    "pickups": parse_pickups(node),
                    "correlations": {Sources.GAMETORA.value: banner_id},
                    "references": [BANNER_INDEX_URL],
                }
            )

        logger.info("Extracted %s banners from Gametora", len(records))
        return records
