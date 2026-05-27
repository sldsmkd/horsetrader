from dataclasses import dataclass
from typing import Any, Optional

from ethicrawl import ResourceList

from horsetrader.core import Config, Japlish, SingletonMeta, StableKey
from horsetrader.extractors.gametora import Gametora
from horsetrader.extractors.umapyoi import Umapyoi
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.semantics import digitan

from .entities import Entities
from .entity import Entity

logger = Logger.get(__name__)


@digitan
@dataclass
class ThreeSizes:
    """The three sizes of a character: bust, waist, and hips in cm"""

    bust: int | None = None
    waist: int | None = None
    hips: int | None = None


@digitan
@dataclass
class Character(Entity):
    name: Japlish
    three_sizes: ThreeSizes
    icon: Image | None = None
    portrait: Image | None = None
    quote: Optional[Japlish] = None

    def match(self, query: str) -> bool:
        if super().match(query):
            return True
        return bool(self.name) and self.name.match(query)


@digitan
class Characters(Entities[Character], metaclass=SingletonMeta):
    SOURCES = (
        "https://gametora.com/ja/umamusume/characters/profiles",
        "https://umapyoi.net/api/v1/character/list",
    )

    def __init__(self) -> None:
        self._incomplete_count = 0
        self._missing_portrait_count = 0
        self._missing_name_count = 0
        super().__init__()

    def stats(self) -> dict[str, Any]:
        return {
            **super().stats(),
            "incomplete": self._incomplete_count,
            "missing_portrait": self._missing_portrait_count,
            "missing_name": self._missing_name_count,
        }

    def search(self, query) -> list[Character]:
        return super().search(query)

    @staticmethod
    def _has_text(value: Optional[Japlish]) -> bool:
        return bool(value and str(value).strip())

    def _validate_item(self, item: Character) -> None:
        missing = []
        if not self._has_text(item.name):
            missing.append("name")
            self._missing_name_count += 1
        if not item.key:
            missing.append("key")

        if missing:
            self._incomplete_count += 1
            logger.warning(
                f"Character {item.key} is incomplete; missing: {', '.join(missing)}"
            )

        if item.portrait is None:
            self._missing_portrait_count += 1
            logger.debug(f"Character {item.key} has no portrait (NPC or unreleased)")

    def _fetch_primary(self) -> list[Character]:
        records = list(Gametora().characters())
        images = self._process_images(records)
        characters: list[Character] = []
        for record in records:
            icon_url = record.get("icon_url")
            portrait_url = record.get("portrait_url")
            icon = images.get(icon_url) if icon_url else None
            portrait = images.get(portrait_url) if portrait_url else None

            references = References(record.get("references", []))
            if icon is not None:
                references.add(icon.references)
            if portrait is not None:
                references.add(portrait.references)

            characters.append(
                Character(
                    key=StableKey(record["key"]),
                    name=record["name"],
                    three_sizes=ThreeSizes(),
                    icon=icon,
                    portrait=portrait,
                    quote=record.get("quote"),
                    correlations=dict(record.get("correlations", {})),
                    references=references,
                )
            )
        return characters

    @staticmethod
    def _process_images(records: list[dict]) -> dict[str, Image | None]:
        outdir = Config().site / "img" / "characters"
        requests: ResourceList[ImageRequest] = ResourceList()
        for record in records:
            key = record.get("key")
            if not key:
                continue
            if icon_url := record.get("icon_url"):
                requests.append(
                    ImageRequest(
                        url=icon_url,
                        outfile=outdir / f"{key}_icon.webp",
                    )
                )
            if portrait_url := record.get("portrait_url"):
                requests.append(
                    ImageRequest(
                        url=portrait_url,
                        outfile=outdir / f"{key}_portrait.webp",
                    )
                )
        if len(requests) == 0:
            return {}
        return CurrenChan().process(requests)

    def _enrichers(self):
        return (self._enrich_with_umapyoi,)

    def _enrich_with_umapyoi(self, c: Character) -> None:
        """Fold Umapyoi data into the character's fields.

        Umapyoi is source-of-truth for `name` and `three_sizes`. For `quote`,
        Gametora's bilingual payload is preferred; only the EN slot is backfilled
        if Umapyoi has EN text that Gametora's Japlish doesn't carry yet.
        """
        record = Umapyoi().character(c.key)
        sizes = record.get("three_sizes", {})

        c.name = record.get("name", c.name)
        c.three_sizes.bust = sizes.get("bust", c.three_sizes.bust)
        c.three_sizes.waist = sizes.get("waist", c.three_sizes.waist)
        c.three_sizes.hips = sizes.get("hips", c.three_sizes.hips)

        umapyoi_quote = record.get("quote")
        if not self._has_text(c.quote):
            c.quote = umapyoi_quote
        elif (
            c.quote is not None
            and umapyoi_quote is not None
            and umapyoi_quote.encoding.value == "en"
        ):
            try:
                c.quote.en  # already has EN
            except ValueError:
                c.quote.en = str(umapyoi_quote)

        c.correlations.update(record.get("correlations", {}))
        c.references.extend(record.get("references", []))


if __name__ == "__main__":
    pass
