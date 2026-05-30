import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from ethicrawl import ResourceList

from horsetrader.core import Config, Period, Periods, SingletonMeta, StableKey
from horsetrader.enums import CostumeVariants, SupportRarity, SupportType
from horsetrader.extractors.gametora import Gametora
from horsetrader.extractors.gametora.banners import BANNER_INDEX_URL
from horsetrader.extractors.static import Static
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.entities import Support, Supports, Trainee, Trainees
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.models.rewards import stamp_first_original_rewards
from horsetrader.semantics import daitaku

from .event import Event
from .events import Events

logger = Logger.get(__name__)

_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_NON_ALNUM_STRICT = re.compile(r"[^a-z0-9]")


def _slugify(value: str) -> str:
    return _NON_ALNUM.sub("-", value.lower()).strip("-")


def _canonical(value: str) -> str:
    return _NON_ALNUM_STRICT.sub("", value.lower())


@daitaku
@dataclass
class Banner(Event):
    """A gacha banner event with a start/end date and a guest list.

    Banner is the abstract parent for the two concrete gacha kinds
    (`SupportBanner`, `TraineeBanner`). Identity is the class itself —
    isinstance dispatch replaces the old `BannerType` enum, and the
    serialisation discriminator is derived from the class name in the
    Eishin mapper layer.
    """

    contents: list[Trainee | Support] = field(default_factory=list, kw_only=True)
    art: Image | None = field(default=None, kw_only=True)

    def match(self, query: str) -> bool:
        return (
            super().match(query)
            or any(c.match(query) for c in self.contents)
        )

    def bake(self, period: Period) -> dict:
        out = super().bake(period)
        # Discriminator from the runtime class: SupportBanner → "support",
        # TraineeBanner → "trainee". Bare Banner shouldn't be instantiated; if
        # it is, fall back to "banner" so the output isn't empty-stringed.
        out["type"] = type(self).__name__.lower().removesuffix("banner") or "banner"
        out["contents"] = [c.key for c in self.contents]
        out["image"] = f"/img/banners/{self.key}.webp"
        return out


@daitaku
@dataclass
class SupportBanner(Banner):
    """A support-card gacha banner."""

    def match(self, query: str) -> bool:
        return super().match(query)

    def bake(self, period: Period) -> dict:
        return super().bake(period)


@daitaku
@dataclass
class TraineeBanner(Banner):
    """A trainee (character) gacha banner."""

    def match(self, query: str) -> bool:
        return super().match(query)

    def bake(self, period: Period) -> dict:
        return super().bake(period)


_TraineeKey = tuple[str, CostumeVariants]
_TraineeIndexes = tuple[dict[_TraineeKey, Trainee], dict[_TraineeKey, Trainee]]

_SupportKey = tuple[str, SupportRarity, SupportType]
_SupportIndexes = tuple[
    dict[_SupportKey, list[Support]],
    dict[_SupportKey, list[Support]],
]


@daitaku
class Banners(Events[Banner], metaclass=SingletonMeta):
    SOURCES = (BANNER_INDEX_URL,)

    def __init__(self) -> None:
        self._trainee_count = 0
        self._support_count = 0
        self._trainee_empty_count = 0
        self._support_empty_count = 0
        super().__init__()

    def stats(self) -> dict[str, Any]:
        return {
            **super().stats(),
            "trainee": self._trainee_count,
            "support": self._support_count,
            "trainee_empty": self._trainee_empty_count,
            "support_empty": self._support_empty_count,
        }

    def search(self, query) -> list[Banner]:
        return super().search(query)

    def _validate_item(self, item: Banner) -> None:
        if not item.key:
            logger.warning("Banner missing key")
            return
        if isinstance(item, TraineeBanner):
            self._trainee_count += 1
            if not item.contents:
                self._trainee_empty_count += 1
                logger.warning(f"Trainee banner {item.key} has no resolvable contents")
        elif isinstance(item, SupportBanner):
            self._support_count += 1
            if not item.contents:
                self._support_empty_count += 1
                logger.warning(f"Support banner {item.key} has no resolvable contents")

    def _enrichers(self):

        def _add_utc_period(banner: Banner) -> None:
            period = Static().banner_period(banner.key)
            if period is not None:
                banner.periods.append(period)
                banner.references.add(str(Config().static / "en.banners.yaml"))

        return (_add_utc_period,)

    _BANNER_CLASSES: dict[str, type[Banner]] = {
        "support": SupportBanner,
        "trainee": TraineeBanner,
    }

    def _fetch_primary(self) -> list[Banner]:
        records = list(Gametora().banners())
        images = self._process_images(records)
        trainee_idx = self._build_trainee_indexes()
        support_idx = self._build_support_indexes()

        banners: list[Banner] = []
        for record in records:
            banner_class = self._BANNER_CLASSES.get(record["banner_type"])
            if banner_class is None:
                logger.warning(
                    "Unknown banner kind %r for %s; skipping",
                    record.get("banner_type"), record.get("key"),
                )
                continue
            contents = self._resolve_contents(banner_class, record, trainee_idx, support_idx)
            art = images.get(record["image_url"])
            references = References(record.get("references", []))
            if art is not None:
                references.add(art.references)
            banners.append(
                banner_class(
                    key=StableKey(record["key"]),
                    periods=Periods([record["period"]]),
                    contents=contents,
                    art=art,
                    correlations=dict(record.get("correlations", {})),
                    references=references,
                )
            )
        stamp_first_original_rewards(banners)
        return banners

    @staticmethod
    def _process_images(records: list[dict]) -> dict[str, Image | None]:
        outdir = Config().site / "img" / "banners"
        requests: ResourceList[ImageRequest] = ResourceList()
        for record in records:
            if image_url := record.get("image_url"):
                requests.append(
                    ImageRequest(
                        url=image_url,
                        outfile=outdir / f"{record['key']}.webp",
                    )
                )
        if not requests:
            return {}
        return CurrenChan().process(requests)

    def _resolve_contents(
        self,
        banner_class: type[Banner],
        record: dict,
        trainee_idx: _TraineeIndexes,
        support_idx: _SupportIndexes,
    ) -> list[Trainee | Support]:
        record_key = record["key"]
        contents: list[Trainee | Support] = []

        if banner_class is TraineeBanner:
            for pickup in record.get("pickups", []):
                trainee = self._resolve_trainee_pickup(pickup, record_key, trainee_idx)
                if trainee is not None:
                    contents.append(trainee)
        elif banner_class is SupportBanner:
            banner_start = record["period"].start
            for pickup in record.get("pickups", []):
                support = self._resolve_support_pickup(
                    pickup, banner_start, record_key, support_idx
                )
                if support is not None:
                    contents.append(support)

        return contents

    @staticmethod
    def _build_trainee_indexes() -> _TraineeIndexes:
        trainees = Trainees().values()
        by_slug: dict[_TraineeKey, Trainee] = {
            (t.character.key, t.variant.variant): t for t in trainees
        }
        by_canonical: dict[_TraineeKey, Trainee] = {
            (_canonical(t.character.key), t.variant.variant): t for t in trainees
        }
        return by_slug, by_canonical

    @staticmethod
    def _build_support_indexes() -> _SupportIndexes:
        by_slug: dict[_SupportKey, list[Support]] = defaultdict(list)
        by_canonical: dict[_SupportKey, list[Support]] = defaultdict(list)
        for s in Supports().values():
            if (
                s.character is None
                or s.type is None
                or s.rarity == SupportRarity.UNKNOWN
            ):
                continue
            by_slug[(s.character.key, s.rarity, s.type)].append(s)
            by_canonical[(_canonical(s.character.key), s.rarity, s.type)].append(s)
        return by_slug, by_canonical

    @staticmethod
    def _resolve_trainee_pickup(
        pickup: dict,
        record_key: str,
        indexes: _TraineeIndexes,
    ) -> Trainee | None:
        # Trainee resolution is single-pass — no rerun fallback. Name spelling
        # is stable in Gametora's data, so a miss here usually means a new
        # character we haven't ingested yet.
        name = pickup["name"]
        descriptor = pickup["descriptor"]

        if descriptor is None:
            costume = CostumeVariants.DEFAULT
        else:
            costume = CostumeVariants.from_en(descriptor)
            if costume is None:
                raise ValueError(
                    f"Unknown costume descriptor {descriptor!r} in banner "
                    f"{record_key}; add it to CostumeVariants and re-run"
                )

        by_slug, by_canonical = indexes
        trainee = by_slug.get((_slugify(name), costume)) or by_canonical.get(
            (_canonical(name), costume)
        )
        if trainee is None:
            logger.warning(
                "No trainee match for %s pickup %r (%s)",
                record_key,
                name,
                descriptor,
            )
        return trainee

    @staticmethod
    def _resolve_support_pickup(
        pickup: dict,
        banner_start: datetime,
        record_key: str,
        indexes: _SupportIndexes,
    ) -> Support | None:
        name = pickup["name"]
        rarity = pickup["support_rarity"]
        sup_type = pickup["support_type"]

        if rarity is None or sup_type is None:
            logger.warning(
                "Unresolvable rarity/type for %s pickup %r",
                record_key,
                name,
            )
            return None

        by_slug, by_canonical = indexes
        candidates = by_slug.get(
            (_slugify(name), rarity, sup_type)
        ) or by_canonical.get((_canonical(name), rarity, sup_type), [])
        if not candidates:
            logger.warning(
                "No support match for %s pickup %r (%s %s)",
                record_key,
                name,
                rarity.name,
                sup_type.name,
            )
            return None

        banner_date = banner_start.date()
        for s in candidates:
            if s.release.start.date() == banner_date:
                return s

        # Rerun — use the most recently originally released card.
        before = [s for s in candidates if s.release.start < banner_start]
        if before:
            return max(before, key=lambda s: s.release.start)

        logger.warning(
            "No pre-banner support match for %s pickup %r (%s %s); all %d "
            "candidates released after banner start %s",
            record_key,
            name,
            rarity.name,
            sup_type.name,
            len(candidates),
            banner_date,
        )
        return None
