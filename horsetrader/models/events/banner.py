import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from math import isclose
from typing import Any

from ethicrawl import ResourceList
from msgspec import UNSET

from horsetrader.core import Config, Period, Periods, SingletonMeta, StableKey
from horsetrader.enums import CostumeVariants, SupportRarity, SupportType
from horsetrader.extractors.gametora import Gametora
from horsetrader.extractors.gametora.banners import BANNER_INDEX_URL
from horsetrader.extractors.static import Static, store
from horsetrader.info import Logger
from horsetrader.models.config import load_gacha_config
from horsetrader.models.core import References
from horsetrader.models.entities import Character, Support, Supports, Trainee, Trainees
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.models.rewards import (
    Rewards,
    rewards_from_baked,
    stamp_first_original_rewards,
)
from horsetrader.output._records import SupportBannerRecord, TraineeBannerRecord
from horsetrader.semantics import daitaku

from .event import Event, Rushable
from .events import Events

logger = Logger.get(__name__)

_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_NON_ALNUM_STRICT = re.compile(r"[^a-z0-9]")

# Special Golden Week banners Gametora lists with no pickups — expected to be
# content-less, so they don't trip the "no resolvable contents" check.
_GOLDEN_WEEK_PICKUPLESS = {"banner-30434", "banner-30264"}


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
    rate_overrides: dict[str, float] = field(default_factory=dict, kw_only=True)
    art: Image | None = field(default=None, kw_only=True)

    def match(self, query: str) -> bool:
        return (
            super().match(query)
            or any(c.match(query) for c in self.contents)
        )

    def _banner_fields(self, period: Period) -> dict:
        # Shared record kwargs for both concrete banners; the runtime class
        # picks the record type (and thus the `type` tag) in `bake`. Bare
        # `Banner` is abstract — it has no record and isn't instantiated.
        return {
            **self._envelope(period),
            "contents": [c.key for c in self.contents],
            "image": f"/img/banners/{self.key}.webp",
            "rate_overrides": self.rate_overrides if self.rate_overrides else UNSET,
        }


@daitaku
@dataclass
class SupportBanner(Banner):
    """A support-card gacha banner."""

    def match(self, query: str) -> bool:
        return super().match(query)

    def bake(self, period: Period) -> SupportBannerRecord:
        return SupportBannerRecord(**self._banner_fields(period))


@daitaku
@dataclass
class TraineeBanner(Banner):
    """A trainee (character) gacha banner."""

    def match(self, query: str) -> bool:
        return super().match(query)

    def bake(self, period: Period) -> TraineeBannerRecord:
        return TraineeBannerRecord(**self._banner_fields(period))


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
        # Special Golden Week banners that genuinely list no pickups on Gametora —
        # whitelisted by id so the "no resolvable contents" check stays a real
        # data-quality signal for every other banner.
        pickupless_ok = str(item.key) in _GOLDEN_WEEK_PICKUPLESS
        if isinstance(item, TraineeBanner):
            self._trainee_count += 1
            if not item.contents and not pickupless_ok:
                self._trainee_empty_count += 1
                logger.warning(f"Trainee banner {item.key} has no resolvable contents")
        elif isinstance(item, SupportBanner):
            self._support_count += 1
            if not item.contents and not pickupless_ok:
                self._support_empty_count += 1
                logger.warning(f"Support banner {item.key} has no resolvable contents")

    def _enrichers(self):

        def _add_utc_period(banner: Banner) -> None:
            period = Static().banner_period(banner.key)
            if period is not None:
                banner.periods.append(period)
                banner.references.add(store.source())
            flags = Static().event_flags(str(banner.key))
            if flags:
                banner.apply_flags(flags)
                banner.references.add(store.source())

        return (_add_utc_period,)

    def _validate_collection(self) -> None:
        """Every curated reward block must land on a real banner (a key that
        matches no banner model is a typo or a stale id — fail loud)."""
        missing = {key for key in Static().banner_rewards() if key not in self}
        if missing:
            raise ValueError(
                f"curated rewards declared for banner(s) with no model: {sorted(missing)}"
            )

    @staticmethod
    def _stamp_curated_rewards(banners: list[Banner]) -> None:
        """Fold each banner's curated ``rewards`` block (e.g. ``{pulls: 4}``)
        onto the model, after the computed first-original carats. Parsing goes
        through the shared ``rewards_from_baked`` so the keys are validated like
        any other curated event's — runs in the primary build (not an enricher),
        so a malformed reward key fails the pipeline loud rather than warning."""
        curated = Static().banner_rewards()
        if not curated:
            return
        by_key = {b.key: b for b in banners}
        for key, raw in curated.items():
            banner = by_key.get(key)
            if banner is None:
                continue  # existence is the collection's check (_validate_collection)
            extra = rewards_from_baked(raw)
            if banner.rewards is None:
                banner.rewards = Rewards()
            banner.rewards.extend(extra)
            banner.references.add(store.source())

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
            contents, rate_overrides = self._resolve_contents(
                banner_class, record, trainee_idx, support_idx
            )
            art = images.get(record["image_url"])
            references = References(record.get("references", []))
            if art is not None:
                references.add(art.references)
            banners.append(
                banner_class(
                    key=StableKey(record["key"]),
                    periods=Periods([record["period"]]),
                    contents=contents,
                    rate_overrides=rate_overrides,
                    art=art,
                    correlations=dict(record.get("correlations", {})),
                    references=references,
                )
            )
        stamp_first_original_rewards(banners)
        self._stamp_curated_rewards(banners)
        return banners

    @staticmethod
    def _process_images(records: list[dict]) -> dict[str, Image | None]:
        outdir = Config().static / "img" / "banners"
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
    ) -> tuple[list[Trainee | Support], dict[str, float]]:
        record_key = record["key"]
        contents: list[Trainee | Support] = []
        rate_overrides: dict[str, float] = {}

        if banner_class is TraineeBanner:
            for pickup in record.get("pickups", []):
                trainee = self._resolve_trainee_pickup(pickup, record_key, trainee_idx)
                if trainee is not None:
                    contents.append(trainee)
                    if override := self._rate_override(pickup, trainee):
                        rate_overrides.update(override)
        elif banner_class is SupportBanner:
            banner_start = record["period"].start
            for pickup in record.get("pickups", []):
                support = self._resolve_support_pickup(
                    pickup, banner_start, record_key, support_idx
                )
                if support is not None:
                    contents.append(support)
                    if override := self._rate_override(pickup, support):
                        rate_overrides.update(override)

        return contents, dict(sorted(rate_overrides.items()))

    @staticmethod
    def _rate_override(pickup: dict, atom: Trainee | Support) -> dict[str, float]:
        """Return this pickup's rate when it differs from the standing default.

        Gametora stores the rate next to each pickup label, but the frontend
        consumes banner contents by stable key. The resolution point is
        therefore the safest place to carry the percentage across.
        """
        rate = pickup.get("rate")
        if rate is None:
            return {}
        tier = Banners._rarity_tier(atom)
        if tier is None:
            return {}
        config = load_gacha_config()
        defaults = config.effective_featured_rates()
        default_rate = defaults.get(tier)
        if default_rate is not None and isclose(rate, default_rate, abs_tol=1e-9):
            return {}
        return {str(atom.key): rate}

    @staticmethod
    def _rarity_tier(atom: Trainee | Support) -> str | None:
        if isinstance(atom, Support):
            if atom.rarity == SupportRarity.SSR:
                return "crystal"
            if atom.rarity == SupportRarity.SR:
                return "gold"
            if atom.rarity == SupportRarity.R:
                return "silver"
            return None
        if atom.variant.rarity == 3:
            return "crystal"
        if atom.variant.rarity == 2:
            return "gold"
        if atom.variant.rarity == 1:
            return "silver"
        return None

    @staticmethod
    def _build_trainee_indexes() -> _TraineeIndexes:
        by_slug: dict[_TraineeKey, Trainee] = {}
        by_canonical: dict[_TraineeKey, Trainee] = {}
        for t in Trainees().values():
            # Pickups are matched by the slugified pickup name, which carries no
            # key prefix — so index on the bare character slug, not the now
            # `char-` prefixed stable key.
            slug = t.character.key.removeprefix(Character.KEY_PREFIX)
            by_slug[(slug, t.variant.variant)] = t
            by_canonical[(_canonical(slug), t.variant.variant)] = t
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
            # Bare character slug, not the `char-` prefixed key — see
            # `_build_trainee_indexes`.
            slug = s.character.key.removeprefix(Character.KEY_PREFIX)
            by_slug[(slug, s.rarity, s.type)].append(s)
            by_canonical[(_canonical(slug), s.rarity, s.type)].append(s)
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

        # GROUP is a collection/obtain label (e.g. "Embodiment of Legends"), not
        # an individual card — it never resolves to a single Support by design.
        # The banner's real cards are listed separately, so skip it quietly.
        if sup_type == SupportType.GROUP:
            logger.debug("Skipping GROUP pickup %r on %s", name, record_key)
            return None

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
