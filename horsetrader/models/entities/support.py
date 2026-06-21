from dataclasses import dataclass, field
from typing import Any, ClassVar

from ethicrawl import ResourceList

from horsetrader.core import Config, Japlish, Period, SingletonMeta, StableKey
from horsetrader.enums import Sources, SupportRarity, SupportType
from horsetrader.extractors.gametora import Gametora
from horsetrader.extractors.static import Static
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
    KEY_PREFIX: ClassVar[str] = "support-"
    release: Period
    character: Character | None = None
    display: Japlish | None = None
    title: Japlish | None = None
    type: SupportType | None = None
    rarity: SupportRarity = SupportRarity.UNKNOWN
    thumbnail: Image | None = None
    art: Image | None = None
    # Card-specific community nicknames; the bake unions these with the
    # character's onto this atom's baked search phrases. Curated.
    aliases: list[str] = field(default_factory=list)
    # Canonical reader-facing source page (Gametora's English entity page),
    # reported by the scraper. The card surface deep-links here; `None` if absent.
    source: str | None = None

    def match(self, query: str) -> bool:
        return (
            super().match(query)
            or (self.character is not None and self.character.match(query))  # incl. character aliases
            or (self.display is not None and self.display.match(query))
            or any(query.lower() in alias.lower() for alias in self.aliases)
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

    def search(self, query) -> list[Support]:
        return super().search(query)

    def _validate_item(self, item: Support) -> None:
        missing = []
        if not item.key:
            missing.append("key")
        if item.thumbnail is None:
            missing.append("thumbnail")
            self._missing_thumbnail_count += 1
        if item.type != SupportType.GROUP and item.character is None:
            missing.append("character")
            self._missing_character_count += 1

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
            char_key = record.get("character_key")
            if char_key is not None:
                character = characters.get(StableKey(f"{Character.KEY_PREFIX}{char_key}"))
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
                    key=StableKey(f"{Support.KEY_PREFIX}{record['key']}"),
                    character=character,
                    display=record.get("character_name"),
                    release=record["release"],
                    title=record.get("title"),
                    type=record.get("support_type"),
                    rarity=SupportRarity.UNKNOWN,
                    thumbnail=thumbnail,
                    art=art,
                    source=record.get("source"),
                    correlations=dict(record.get("correlations", {})),
                    references=references,
                )
            )
        return supports

    def _enrichers(self):
        return (self._enrich_with_umapyoi, self._enrich_with_aliases)

    def _enrich_with_aliases(self, s: Support) -> None:
        """Fold curated card-specific nicknames onto the support (search phrases)."""
        s.aliases = Static().search_aliases().get(s.key, [])

    def _validate_collection(self) -> None:
        """Every curated `support-` alias target must name a real support."""
        missing = {
            target
            for target in Static().search_aliases()
            if target.startswith(Support.KEY_PREFIX) and target not in self
        }
        if missing:
            raise ValueError(
                f"search_aliases.yaml support target(s) match no support: {sorted(missing)}"
            )

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
        outdir = Config().static / "img" / "supports"
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
