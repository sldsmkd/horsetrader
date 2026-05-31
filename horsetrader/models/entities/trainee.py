from dataclasses import dataclass
from typing import Any, ClassVar

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

    def match(self, query: str) -> bool:
        return self.title.match(query) or self.variant.match(query)


@digitan
@dataclass
class Trainee(Entity):
    KEY_PREFIX: ClassVar[str] = "trainee-"
    character: Character
    release: Period
    variant: TraineeVariant
    thumbnail: Image | None = None
    portrait: Image | None = None

    def match(self, query: str) -> bool:
        return (
            super().match(query)
            or self.character.match(query)
            or self.variant.match(query)
        )


@digitan
class Trainees(Entities[Trainee], metaclass=SingletonMeta):
    SOURCES = ("https://gametora.com/ja/umamusume/characters",)

    def __init__(self) -> None:
        self._incomplete_count = 0
        self._missing_portrait_count = 0
        self._missing_character_count = 0
        super().__init__()

    def stats(self) -> dict[str, Any]:
        return {
            **super().stats(),
            "incomplete": self._incomplete_count,
            "missing_portrait": self._missing_portrait_count,
            "missing_character": self._missing_character_count,
        }

    def search(self, query) -> list[Trainee]:
        return super().search(query)

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
            for c in Characters().values()
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
            thumbnail = images.get(thumbnail_url) if thumbnail_url else None
            portrait = images.get(portrait_url) if portrait_url else None

            references = References(record.get("references", []))
            if thumbnail is not None:
                references.add(thumbnail.references)
            if portrait is not None:
                references.add(portrait.references)

            trainees.append(
                Trainee(
                    key=StableKey(f"{Trainee.KEY_PREFIX}{record['key']}"),
                    character=character,
                    release=record["release"],
                    variant=TraineeVariant(
                        variant=CostumeVariants[record["variant_name"]],
                        title=record["title"],
                        rarity=record["rarity"],
                    ),
                    thumbnail=thumbnail,
                    portrait=portrait,
                    correlations=dict(record.get("correlations", {})),
                    references=references,
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

    def _enrichers(self):
        return (self._enrich_with_umapyoi,)

    def _enrich_with_umapyoi(self, t: Trainee) -> None:
        """Backfill the EN slot on the trainee's outfit title from Umapyoi.

        Umapyoi contributes the EN title text only; everything else is
        Gametora-sourced and already on the trainee. Skips silently if either
        side of the (trainee_id, gametora_id) correlation is missing.
        """
        trainee_id = t.correlations.get(Sources.GAMETORA.value)
        gametora_id = t.character.correlations.get(Sources.GAMETORA.value)
        if not trainee_id or not gametora_id:
            return

        record = Umapyoi().trainee(int(trainee_id), int(gametora_id))
        en_title = record.get("title")
        if en_title is not None and en_title.encoding.value == "en":
            try:
                t.variant.title.en  # already has EN
            except ValueError:
                t.variant.title.en = str(en_title)

        t.references.extend(record.get("references", []))
