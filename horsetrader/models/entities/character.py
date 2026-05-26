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
class Characters(Entities[Character, Character, Character], metaclass=SingletonMeta):
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

    @staticmethod
    def _has_text(value: Optional[Japlish]) -> bool:
        return bool(value and str(value).strip())

    def _validate_item(self, item: Character) -> None:
        """Warn if a character record is missing critical fields."""
        missing = []
        if not self._has_text(item.name):
            missing.append("name")
            self._missing_name_count += 1
        if not item.key:
            missing.append("key")
        if item.portrait is None:
            missing.append("portrait")
            self._missing_portrait_count += 1

        if missing:
            self._incomplete_count += 1
            logger.warning(
                f"Character {item.key} is incomplete; missing: {', '.join(missing)}"
            )

    def _merge_one(
        self, primary_item: Character, secondary_item: Character
    ) -> Character:
        # Keep Gametora key and image URL as source-of-truth.
        # Use Umapyoi as source-of-truth for name and three_sizes.
        secondary_has_pull_quote = self._has_text(secondary_item.quote)

        merged_references = References(primary_item.references)
        merged_references.add(secondary_item.references)

        merged_correlations = {
            **primary_item.correlations,
            **secondary_item.correlations,
        }

        # Prefer primary (Gametora) pull_quote as it may be bilingual (JP tagline + EN).
        # If Umapyoi has EN text and primary has no EN slot yet, backfill it.
        _quote = (
            primary_item.quote
            if self._has_text(primary_item.quote)
            else secondary_item.quote
        )
        if (
            _quote is not None
            and secondary_item.quote is not None
            and secondary_has_pull_quote
            and _quote is primary_item.quote
            and secondary_item.quote.encoding.value == "en"
        ):
            try:
                _quote.en  # already has EN
            except ValueError:
                _quote.en = str(secondary_item.quote)

        return Character(
            key=primary_item.key,
            correlations=merged_correlations,
            references=merged_references,
            name=secondary_item.name,
            three_sizes=secondary_item.three_sizes,
            icon=primary_item.icon,
            portrait=primary_item.portrait,
            quote=_quote,
        )

    def _fetch_primary(self) -> list[Character]:
        records = list(Gametora().characters())
        images = self._process_images(records)
        characters: list[Character] = []
        for record in records:
            icon_url = record.get("icon_url")
            portrait_url = record.get("portrait_url")
            characters.append(
                Character(
                    key=StableKey(record["key"]),
                    name=record["name"],
                    three_sizes=ThreeSizes(),
                    icon=images.get(icon_url) if icon_url else None,
                    portrait=images.get(portrait_url) if portrait_url else None,
                    quote=record.get("quote"),
                    correlations=dict(record.get("correlations", {})),
                    references=References(record.get("references", [])),
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

    def _enrich_one(self, primary_item: Character) -> Character:
        record = Umapyoi().character(primary_item.key)
        sizes = record.get("three_sizes", {})
        return Character(
            key=primary_item.key,
            name=record.get("name", primary_item.name),
            three_sizes=ThreeSizes(
                bust=sizes.get("bust"),
                waist=sizes.get("waist"),
                hips=sizes.get("hips"),
            ),
            icon=record.get("icon"),
            portrait=record.get("portrait"),
            quote=record.get("quote"),
            correlations=dict(record.get("correlations", {})),
            references=References(record.get("references", [])),
        )

    def _on_enrich_error(self, primary_item: Character, error: Exception) -> Character:
        logger.warning(
            f"Failed to enrich character {primary_item.key} from umapyoi; using Gametora-only data: {error}"
        )
        return primary_item


if __name__ == "__main__":
    pass
