from dataclasses import dataclass
from typing import Any

from ethicrawl import ResourceList

from horsetrader.core import Config, Japlish, SingletonMeta, StableKey
from horsetrader.extractors.gametora import Gametora
from horsetrader.info import Logger
from horsetrader.models.core import References, TracenModel, TracenModels
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.semantics import yayoi

logger = Logger.get(__name__)


@yayoi
@dataclass
class Item(TracenModel):
    """A Gametora-indexed in-game item — icon + JP/EN name, keyed by
    `item-<gametora-id>` (e.g. `item-00043` for carats).

    Items are Yayoi's, not Digitan's: they're the underlying assets that
    typed `Reward` subclasses point at via `item_key`. Story-event reward
    rows that don't map to a known `Reward` subclass can still resolve to
    an `Item` here, so downstream consumers always have a name + icon
    even when the typed-reward table hasn't been extended yet.
    """

    name: Japlish
    icon: Image | None = None

    def match(self, query: str) -> bool:
        if super().match(query):
            return True
        return bool(self.name) and self.name.match(query)


@yayoi
class Items(TracenModels[Item], metaclass=SingletonMeta):
    """Collection of every item Gametora indexes on its items pages.

    Loaded eagerly under Pipeline orchestration like every other
    `TracenModels` stage. `Reward.item()` resolves through this singleton
    at consume time, replacing the previous hand-curated icon-id constant
    table.
    """

    SOURCES = (
        "https://gametora.com/umamusume/items",
        "https://gametora.com/ja/umamusume/items",
    )

    def __init__(self) -> None:
        self._missing_icon_count = 0
        self._missing_jp_count = 0
        self._missing_en_count = 0
        super().__init__()

    def stats(self) -> dict[str, Any]:
        return {
            **super().stats(),
            "missing_icon": self._missing_icon_count,
            "missing_jp": self._missing_jp_count,
            "missing_en": self._missing_en_count,
        }

    def search(self, query) -> list[Item]:
        return super().search(query)

    def _validate_item(self, item: Item) -> None:
        if item.icon is None:
            self._missing_icon_count += 1
            logger.debug(f"Item {item.key} has no icon")
        try:
            item.name.jp
        except ValueError:
            self._missing_jp_count += 1
        try:
            item.name.en
        except ValueError:
            self._missing_en_count += 1

    def _fetch_primary(self) -> list[Item]:
        records = list(Gametora().items())
        icons = self._process_icons(records)

        items: list[Item] = []
        for record in records:
            icon_url = record.get("icon_url")
            icon = icons.get(icon_url) if icon_url else None

            name = self._build_name(record)

            references = References(record.get("references", []))
            if icon is not None:
                references.add(icon.references)

            items.append(
                Item(
                    key=StableKey(record["key"]),
                    name=name,
                    icon=icon,
                    correlations=dict(record.get("correlations", {})),
                    references=references,
                )
            )
        return items

    @staticmethod
    def _build_name(record: dict) -> Japlish:
        """JP is the canonical base payload (the items page is a JP-first
        index); EN attaches as a translation slot. Falls back to EN-only
        when Gametora hasn't published a JP record for the icon yet.
        """
        name_jp = record.get("name_jp")
        name_en = record.get("name_en")
        if name_jp:
            name = Japlish(name_jp, encoding="jp")
            if name_en:
                name.en = name_en
            return name
        return Japlish(name_en or "", encoding="en")

    @staticmethod
    def _process_icons(records: list[dict]) -> dict[str, Image | None]:
        outdir = Config().site / "img" / "items"
        requests: ResourceList[ImageRequest] = ResourceList()
        for record in records:
            key = record.get("key")
            icon_url = record.get("icon_url")
            if not key or not icon_url:
                continue
            requests.append(
                ImageRequest(
                    url=icon_url,
                    outfile=outdir / f"{key}_icon.webp",
                )
            )
        if len(requests) == 0:
            return {}
        return CurrenChan().process(requests)
