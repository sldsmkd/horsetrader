import re
from collections import defaultdict
from dataclasses import dataclass, field

from horsetrader.core import SingletonMeta, StableKey
from horsetrader.enums import BannerType, CostumeVariants, SupportRarity, SupportType
from horsetrader.extractors.gametora import Gametora
from horsetrader.extractors.gametora.banners import BANNER_INDEX_URL
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
    """A gacha banner event with a start/end date, type, prediction flag, and guest list."""

    type: BannerType = field(default=BannerType.SUPPORT, kw_only=True)
    predicted: bool = field(default=False, kw_only=True)
    contents: list[Trainee | Support] = field(default_factory=list, kw_only=True)


_SupportKey = tuple[str, SupportRarity, SupportType]


@daitaku
class Banners(Events[Banner], metaclass=SingletonMeta):
    SOURCES = (BANNER_INDEX_URL,)

    def _validate_item(self, item: Banner) -> None:
        if not item.key:
            logger.warning("Banner missing key")

    def _fetch_primary(self) -> list[Banner]:
        records = list(Gametora().banners())

        trainees = Trainees()
        trainee_index: dict[tuple[str, CostumeVariants], Trainee] = {
            (t.character.key, t.variant.variant): t for t in trainees.values()
        }
        canonical_trainee_index: dict[tuple[str, CostumeVariants], Trainee] = {
            (_canonical(t.character.key), t.variant.variant): t
            for t in trainees.values()
        }
        en_to_cv: dict[str, CostumeVariants] = {
            str(cv.en): cv for cv in CostumeVariants
        }

        support_index: dict[_SupportKey, list[Support]] = defaultdict(list)
        canonical_support_index: dict[_SupportKey, list[Support]] = defaultdict(list)
        for s in Supports().values():
            if s.character is None or s.type is None or s.rarity == SupportRarity.UNKNOWN:
                continue
            k: _SupportKey = (s.character.key, s.rarity, s.type)
            support_index[k].append(s)
            ck: _SupportKey = (_canonical(s.character.key), s.rarity, s.type)
            canonical_support_index[ck].append(s)

        banners: list[Banner] = []
        for record in records:
            contents: list[Trainee | Support] = []
            banner_type = record["banner_type"]
            banner_start = record["period"].start

            if banner_type == BannerType.TRAINEE:
                for pickup in record.get("pickups", []):
                    name = pickup["name"]
                    descriptor = pickup["descriptor"]

                    if descriptor is None:
                        costume = CostumeVariants.DEFAULT
                    else:
                        costume = en_to_cv.get(descriptor)
                        if costume is None:
                            logger.warning(
                                "Unknown descriptor %r in %s", descriptor, record["key"]
                            )
                            continue

                    char_slug = _slugify(name)
                    trainee = trainee_index.get(
                        (char_slug, costume)
                    ) or canonical_trainee_index.get((_canonical(name), costume))
                    if trainee is not None:
                        contents.append(trainee)
                    else:
                        logger.warning(
                            "No trainee match for %s pickup %r (%s)",
                            record["key"],
                            name,
                            descriptor,
                        )

            elif banner_type == BannerType.SUPPORT:
                for pickup in record.get("pickups", []):
                    name = pickup["name"]
                    rarity = _parse_support_rarity(pickup["support_rarity"])
                    sup_type = _parse_support_type(pickup["support_type"])

                    if rarity is None or sup_type is None:
                        logger.warning(
                            "Unresolvable rarity/type for %s pickup %r",
                            record["key"],
                            name,
                        )
                        continue

                    char_slug = _slugify(name)
                    candidates = support_index.get(
                        (char_slug, rarity, sup_type)
                    ) or canonical_support_index.get(
                        (_canonical(name), rarity, sup_type), []
                    )

                    if not candidates:
                        logger.warning(
                            "No support match for %s pickup %r (%s %s)",
                            record["key"],
                            name,
                            rarity.name,
                            sup_type.name,
                        )
                        continue

                    banner_date = banner_start.date()
                    released_on_banner = [
                        s for s in candidates
                        if s.release.start.date() == banner_date
                    ]

                    if released_on_banner:
                        contents.append(released_on_banner[0])
                    else:
                        # Rerun — use the most recently originally released card.
                        before = [s for s in candidates if s.release.start < banner_start]
                        if before:
                            contents.append(max(before, key=lambda s: s.release.start))
                        else:
                            logger.warning(
                                "No support match for %s pickup %r (%s %s)",
                                record["key"],
                                name,
                                rarity.name,
                                sup_type.name,
                            )

            banners.append(
                Banner(
                    key=StableKey(record["key"]),
                    period=record["period"],
                    type=record["banner_type"],
                    contents=contents,
                    correlations=dict(record.get("correlations", {})),
                    references=References(record.get("references", [])),
                )
            )
        return banners
