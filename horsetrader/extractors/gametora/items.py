import re
from collections.abc import Sequence

from lxml import html

from horsetrader.core import SingletonMeta
from horsetrader.enums import CacheTime, Sources
from horsetrader.extractors.helpers import xpath_all, xpath_attr, xpath_first
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)

_GAMETORA_BASE_URL = "https://gametora.com"
_ITEMS_URL_EN = "https://gametora.com/umamusume/items"
_ITEMS_URL_JP = "https://gametora.com/ja/umamusume/items"
_ITEMS_MAIN_EXPR = "//main"
_ITEM_BOX_EXPR = './/div[contains(@class, "items_box__")]'
_ITEM_IMG_EXPR = './/img[contains(@src, "/items/item_icon_")]'
_ITEM_NAME_EXPR = ".//b"
_ITEM_ID_PATTERN = re.compile(r"/items/item_icon_(\d+)\.png")


@transcend
class GametoraItems(metaclass=SingletonMeta):
    """Scraper for the Gametora items index (EN + JP pages)."""

    def __init__(self):
        self._uc = UmaClient()

    def _scrape(self, url: str) -> dict[str, dict]:
        tree = html.fromstring(self._uc.get(url, chrome=True, cache=CacheTime.LEAF))
        main = xpath_first(tree, _ITEMS_MAIN_EXPR)
        if main is None:
            raise ValueError(f"Gametora items: main block not found on {url}")

        boxes = xpath_all(main, _ITEM_BOX_EXPR)
        if not boxes:
            raise ValueError(f"Gametora items: no item boxes found on {url}")

        out: dict[str, dict] = {}
        for box in boxes:
            src = xpath_attr(box, _ITEM_IMG_EXPR, "src") or ""
            id_match = _ITEM_ID_PATTERN.search(src)
            if not id_match:
                continue
            item_id = id_match.group(1)
            # First box for a given item-id wins — duplicates are gallery
            # variants of the same item, not distinct entries.
            if item_id in out:
                continue

            name_node = xpath_first(box, _ITEM_NAME_EXPR)
            name = (name_node.text_content() if name_node is not None else "").strip()
            if not name:
                logger.warning("Empty name for item %s on %s; skipping", item_id, url)
                continue

            out[item_id] = {
                "item_id": item_id,
                "name": name,
                "icon_url": f"{_GAMETORA_BASE_URL}{src}",
            }
        return out

    def items(self) -> Sequence[dict]:
        en = self._scrape(_ITEMS_URL_EN)
        if not en:
            raise ValueError("Gametora items: no records extracted from EN page")
        jp = self._scrape(_ITEMS_URL_JP)
        if not jp:
            raise ValueError("Gametora items: no records extracted from JP page")

        out: list[dict] = []
        for item_id, en_rec in sorted(en.items()):
            jp_rec = jp.get(item_id)
            if jp_rec is None:
                logger.warning("Gametora items: no JP record for item %s", item_id)
            out.append(
                {
                    "key": f"item-{item_id}",
                    "gametora_id": int(item_id),
                    "name_en": en_rec["name"],
                    "name_jp": jp_rec["name"] if jp_rec else None,
                    "icon_url": en_rec["icon_url"],
                    "correlations": {Sources.GAMETORA.value: int(item_id)},
                    "references": [_ITEMS_URL_EN, _ITEMS_URL_JP],
                }
            )
        logger.info("Extracted %d items from Gametora", len(out))
        return out
