from dataclasses import dataclass
from typing import Any

from ethicrawl import ResourceList

from horsetrader.core import Config, Japlish, Period, SingletonMeta, StableKey
from horsetrader.enums import CostumeVariants, Sources
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
class TraineeVariant:
    variant: CostumeVariants
    title: Japlish
    rarity: int  # 1-3 for trainees; 1-5 for characters

    def __post_init__(self):
        if self.variant == CostumeVariants.DEFAULT and self.rarity not in {1, 2, 3}:
            raise ValueError("Default costumes must have rarity 1-3")
        if self.variant != CostumeVariants.DEFAULT and self.rarity != 3:
            raise ValueError("Non-default costumes must have rarity 3")


@digitan
@dataclass
class Trainee(Entity):
    character: Character
    release: Period
    variant: TraineeVariant
    thumbnail: Image | None = None
    portrait: Image | None = None


@digitan
class Trainees(Entities[Trainee, Trainee, Trainee], metaclass=SingletonMeta):
    SOURCES = ("https://gametora.com/ja/umamusume/characters",)

    def __init__(self) -> None:
        self._incomplete_count = 0
        self._missing_portrait_count = 0
        self._missing_character_count = 0
        super().__init__()

    def trainee(
        self,
        character_key: str,
        variant: CostumeVariants | None = None,
    ) -> Trainee | None:
        """Find a trainee by character key and optional variant.

        When ``variant`` is ``None``, returns the default costume
        (``CostumeVariants.DEFAULT``) when available.
        """
        direct = self.get(character_key)
        if direct is not None:
            return direct

        candidates = self.trainees(character_key)
        if not candidates:
            return None

        if variant is None:
            for trainee in candidates:
                if trainee.variant.variant == CostumeVariants.DEFAULT:
                    return trainee
            return candidates[0]

        for trainee in candidates:
            if trainee.variant.variant == variant:
                return trainee
        return None

    def trainees(self, character_key: str | None = None) -> list[Trainee]:
        """Return trainees, optionally filtered by character key."""
        items = self.all()
        if character_key is None:
            return items
        return sorted(
            [t for t in items if t.character.key == character_key],
            key=lambda t: t.key,
        )

    def stats(self) -> dict[str, Any]:
        return {
            **super().stats(),
            "incomplete": self._incomplete_count,
            "missing_portrait": self._missing_portrait_count,
            "missing_character": self._missing_character_count,
        }

    def _validate_item(self, item: Trainee) -> None:
        missing = []
        if not item.key:
            missing.append("key")
        if item.portrait is None:
            missing.append("portrait")
            self._missing_portrait_count += 1
        if item.character is None:
            missing.append("character")
            self._missing_character_count += 1

        if missing:
            self._incomplete_count += 1
            logger.warning(
                f"Trainee {item.key} is incomplete; missing: {', '.join(missing)}"
            )

    def _fetch_primary(self) -> list[Trainee]:
        records = list(Gametora().trainees())
        characters_by_gametora_id = {
            c.correlations[Sources.GAMETORA.value]: c
            for c in Characters()
            if Sources.GAMETORA.value in c.correlations
        }

        records = [
            record
            for record in records
            if self._has_character(record, characters_by_gametora_id)
        ]

        images = self._process_images(records)
        trainees: list[Trainee] = []
        for record in records:
            character = characters_by_gametora_id[record["character_gametora_id"]]
            thumbnail_url = record.get("thumbnail_url")
            portrait_url = record.get("portrait_url")
            trainees.append(
                Trainee(
                    key=StableKey(record["key"]),
                    character=character,
                    release=record["release"],
                    variant=TraineeVariant(
                        variant=CostumeVariants[record["variant_name"]],
                        title=record["title"],
                        rarity=record["rarity"],
                    ),
                    thumbnail=images.get(thumbnail_url) if thumbnail_url else None,
                    portrait=images.get(portrait_url) if portrait_url else None,
                    correlations=dict(record.get("correlations", {})),
                    references=References(record.get("references", [])),
                )
            )
        return trainees

    @staticmethod
    def _has_character(
        record: dict, characters_by_gametora_id: dict[int, Character]
    ) -> bool:
        gametora_id = record.get("character_gametora_id")
        if gametora_id in characters_by_gametora_id:
            return True
        logger.warning(
            f"Skipping trainee {record.get('key')}: character {gametora_id} not found"
        )
        return False

    @staticmethod
    def _process_images(records: list[dict]) -> dict[str, Image | None]:
        outdir = Config().site / "img" / "trainees"
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

    def _enrich_one(self, primary_item: Trainee) -> Trainee:
        trainee_id = primary_item.correlations.get(Sources.GAMETORA.value)
        gametora_id = primary_item.character.correlations.get(Sources.GAMETORA.value)
        if not trainee_id or not gametora_id:
            return primary_item

        record = Umapyoi().trainee(int(trainee_id), int(gametora_id))
        en_title = record.get("title")

        title = Japlish(
            str(primary_item.variant.title),
            encoding=primary_item.variant.title.encoding,
        )
        if en_title is not None and en_title.encoding.value == "en":
            try:
                title.en  # already has EN
            except ValueError:
                title.en = str(en_title)

        return Trainee(
            key=primary_item.key,
            character=primary_item.character,
            release=primary_item.release,
            variant=TraineeVariant(
                variant=primary_item.variant.variant,
                title=title,
                rarity=primary_item.variant.rarity,
            ),
            thumbnail=primary_item.thumbnail,
            portrait=primary_item.portrait,
            correlations=dict(primary_item.correlations),
            references=References(record.get("references", [])),
        )

    def _on_enrich_error(self, primary_item: Trainee, error: Exception) -> Trainee:
        logger.warning(
            f"Failed to enrich trainee {primary_item.key} from umapyoi; "
            f"using Gametora-only data: {error}"
        )
        return primary_item

    def _merge_one(self, primary_item: Trainee, secondary_item: Trainee) -> Trainee:
        merged_references = References(primary_item.references)
        merged_references.add(secondary_item.references)

        merged_correlations = {
            **primary_item.correlations,
            **secondary_item.correlations,
        }

        return Trainee(
            key=primary_item.key,
            character=primary_item.character,
            release=primary_item.release,
            variant=secondary_item.variant,
            thumbnail=primary_item.thumbnail,
            portrait=primary_item.portrait,
            correlations=merged_correlations,
            references=merged_references,
        )
