import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from horsetrader.core import Periods, SingletonMeta, StableKey
from horsetrader.enums import BannerType, CostumeVariants, SupportRarity, SupportType
from horsetrader.extractors.gametora import Gametora
from horsetrader.extractors.gametora.banners import BANNER_INDEX_URL
from horsetrader.extractors.static import Static
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.entities import Support, Supports, Trainee, Trainees
from horsetrader.semantics import daitaku

from .event import Event
from .events import Events

logger = Logger.get(__name__)

_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_NON_ALNUM_STRICT = re.compile(r"[^a-z0-9]")

# Gametora uses "Friend" for what we call PAL
_SUPPORT_TYPE_ALIAS: dict[str, SupportType] = {"friend": SupportType.PAL}


def _slugify(value: str) -> str:
    return _NON_ALNUM.sub("-", value.lower()).strip("-")


def _canonical(value: str) -> str:
    return _NON_ALNUM_STRICT.sub("", value.lower())


def _parse_support_rarity(raw: str | None) -> SupportRarity | None:
    if raw is None:
        return None
    try:
        return SupportRarity[raw.upper()]
    except KeyError:
        return None


def _parse_support_type(raw: str | None) -> SupportType | None:
    if raw is None:
        return None
    normed = raw.lower()
    try:
        return SupportType(normed)
    except ValueError:
        return _SUPPORT_TYPE_ALIAS.get(normed)


@daitaku
@dataclass
class Banner(Event):
    """A gacha banner event with a start/end date, type and guest list."""

    type: BannerType = field(default=BannerType.SUPPORT, kw_only=True)
    contents: list[Trainee | Support] = field(default_factory=list, kw_only=True)

    def match(self, query: str) -> bool:
        needle = query.lower()
        return (
            super().match(query)
            or needle in self.type.name.lower()
            or needle in self.type.value.lower()
            or any(c.match(query) for c in self.contents)
        )


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
        if item.type == BannerType.TRAINEE:
            self._trainee_count += 1
            if not item.contents:
                self._trainee_empty_count += 1
                logger.warning(f"Trainee banner {item.key} has no resolvable contents")
        elif item.type == BannerType.SUPPORT:
            self._support_count += 1
            if not item.contents:
                self._support_empty_count += 1
                logger.warning(f"Support banner {item.key} has no resolvable contents")

    def _enrichers(self):
        static = Static()

        def _add_utc_period(banner: Banner) -> None:
            period = static.banner_period(banner.key)
            if period is not None:
                banner.periods.append(period)
                banner.references.add(static.en_banners_path)

        return (_add_utc_period,)

    def _fetch_primary(self) -> list[Banner]:
        records = list(Gametora().banners())
        trainee_idx = self._build_trainee_indexes()
        support_idx = self._build_support_indexes()

        banners: list[Banner] = []
        for record in records:
            contents = self._resolve_contents(record, trainee_idx, support_idx)
            banners.append(
                Banner(
                    key=StableKey(record["key"]),
                    periods=Periods([record["period"]]),
                    type=record["banner_type"],
                    contents=contents,
                    correlations=dict(record.get("correlations", {})),
                    references=References(record.get("references", [])),
                )
            )
        return banners

    def _resolve_contents(
        self,
        record: dict,
        trainee_idx: _TraineeIndexes,
        support_idx: _SupportIndexes,
    ) -> list[Trainee | Support]:
        banner_type = record["banner_type"]
        record_key = record["key"]
        contents: list[Trainee | Support] = []

        if banner_type == BannerType.TRAINEE:
            for pickup in record.get("pickups", []):
                trainee = self._resolve_trainee_pickup(pickup, record_key, trainee_idx)
                if trainee is not None:
                    contents.append(trainee)
        elif banner_type == BannerType.SUPPORT:
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
        rarity = _parse_support_rarity(pickup["support_rarity"])
        sup_type = _parse_support_type(pickup["support_type"])

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
