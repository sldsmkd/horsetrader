from dataclasses import dataclass
from typing import Any

from ethicrawl import ResourceList

from horsetrader.core import Config, Japlish, Period, SingletonMeta, StableKey
from horsetrader.enums import Sources, SupportRarity, SupportType
from horsetrader.extractors.gametora import Gametora
from horsetrader.extractors.umapyoi import Umapyoi
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.semantics import digitan

from .character import Character, Characters
from .entities import Entities
from .entity import Entity

logger = Logger.get(__name__)


@digitan
@dataclass
class Support(Entity):
    release: Period
    character: Character | None = None
    display: Japlish | None = None
    title: Japlish | None = None
    type: SupportType | None = None
    rarity: SupportRarity = SupportRarity.UNKNOWN
    thumbnail: Image | None = None
    art: Image | None = None

    def __post_init__(self) -> None:
        if self.character is not None and self.display is not None:
            raise ValueError(
                f"Support {self.key}: character and display are mutually exclusive"
            )

    def match(self, query: str) -> bool:
        return (
            super().match(query)
            or (self.character is not None and self.character.match(query))
            or (self.display is not None and self.display.match(query))
        )


@digitan
class Supports(Entities[Support], metaclass=SingletonMeta):
    SOURCES = ("https://gametora.com/ja/umamusume/supports",)

    def __init__(self) -> None:
        self._incomplete_count = 0
        self._missing_thumbnail_count = 0
        self._missing_character_count = 0
        super().__init__()

    def stats(self) -> dict[str, Any]:
        return {
            **super().stats(),
            "incomplete": self._incomplete_count,
            "missing_thumbnail": self._missing_thumbnail_count,
            "missing_character": self._missing_character_count,
        }

    def _validate_item(self, item: Support) -> None:
        missing = []
        if not item.key:
            missing.append("key")
        if item.thumbnail is None:
            missing.append("thumbnail")
            self._missing_thumbnail_count += 1

        if missing:
            self._incomplete_count += 1
            logger.warning(
                f"Support {item.key} is incomplete; missing: {', '.join(missing)}"
            )

    def _fetch_primary(self) -> list[Support]:
        records = list(Gametora().supports())
        characters = Characters()

        matched: list[tuple[dict, Character | None]] = []
        for record in records:
            character: Character | None = None
            if not record.get("support_type") == SupportType.GROUP:
                key = str(record.get("key", ""))
                char_key = StableKey(key.split("-", 1)[1]) if "-" in key else None
                character = characters.get(char_key) if char_key else None
                if character is None:
                    self._missing_character_count += 1
                    logger.error(
                        f"Support {key}: no character found for key '{char_key}'"
                    )
            matched.append((record, character))

        images = self._process_images([r for r, _ in matched])
        supports: list[Support] = []
        for record, character in matched:
            thumbnail_url = record.get("thumbnail_url")
            art_url = record.get("art_url")
            thumbnail = images.get(thumbnail_url) if thumbnail_url else None
            art = images.get(art_url) if art_url else None

            references = References(record.get("references", []))
            if thumbnail is not None:
                references.add(thumbnail.references)
            if art is not None:
                references.add(art.references)

            supports.append(
                Support(
                    key=StableKey(record["key"]),
                    character=character,
                    display=record.get("character_name") if record.get("support_type") == SupportType.GROUP else None,
                    release=record["release"],
                    title=record.get("title"),
                    type=record.get("support_type"),
                    rarity=SupportRarity.UNKNOWN,
                    thumbnail=thumbnail,
                    art=art,
                    correlations=dict(record.get("correlations", {})),
                    references=references,
                )
            )
        return supports

    def _enrichers(self):
        return (self._enrich_with_umapyoi,)

    def _enrich_with_umapyoi(self, s: Support) -> None:
        support_id = s.correlations.get(Sources.GAMETORA.value)
        if not isinstance(support_id, int):
            return
        record = Umapyoi().support(support_id)
        rarity_string = record.get("rarity_string")
        if isinstance(rarity_string, str):
            try:
                s.rarity = SupportRarity[rarity_string.upper()]
            except KeyError:
                logger.warning(f"Unknown rarity '{rarity_string}' for support {s.key}")
        s.references.extend(record.get("references", []))

    @staticmethod
    def _process_images(records: list[dict]) -> dict[str, Image | None]:
        outdir = Config().site / "img" / "supports"
        requests: ResourceList[ImageRequest] = ResourceList()
        for record in records:
            key = record.get("key")
            if not key:
                continue
            if thumbnail_url := record.get("thumbnail_url"):
                requests.append(
                    ImageRequest(
                        url=thumbnail_url,
                        outfile=outdir / f"{key}_thumbnail.webp",
                    )
                )
            if art_url := record.get("art_url"):
                requests.append(
                    ImageRequest(
                        url=art_url,
                        outfile=outdir / f"{key}_art.webp",
                    )
                )
        if len(requests) == 0:
            return {}
        return CurrenChan().process(requests)


# 2026-05-27 10:45:34,490 - horsetrader.models.entities.support - ERROR - Support 10109-yayoi-akikawa: no character matched '秋川理事長'
# "display": "The Throne's Assemblage"
