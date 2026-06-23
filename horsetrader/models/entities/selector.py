from dataclasses import dataclass, field
from enum import Enum
from typing import ClassVar

from horsetrader.core import JST, SingletonMeta, StableKey
from horsetrader.enums import CostumeVariants
from horsetrader.info import Logger
from horsetrader.semantics import digitan

from .entities import Entities
from .entity import Entity

logger = Logger.get(__name__)


class SelectorKind(Enum):
    """What a selector exchanges for. Free selectors are always `SSR_SUPPORT`;
    `TRAINEE` (★3) selectors are a paid product."""

    SSR_SUPPORT = "ssr_support"
    TRAINEE = "trainee"


# --- Inferred construction knowledge (the irreducible non-structural facts) ----
#
# The cutoff (hence the pool — what a selector is *valid for*) is DERIVED
# structurally from the timeline; see `Selectors._fetch_primary`. These tables are
# what the discovery pass established and the bake can't recover on its own.

# The trainee costume variants that mark each seasonal event — the seasonal banner
# is the cutoff anchor. "Summer" spans the plain Summer and Summer-Trip outfits.
_SEASON_VARIANTS: dict[str, set[CostumeVariants]] = {
    "summer": {CostumeVariants.SUMMER, CostumeVariants.SUMMER_WALK},
    "new_year": {CostumeVariants.NEW_YEAR},
    "valentine": {CostumeVariants.VALENTINE},
}


def _season_for(version: str) -> str:
    """Which seasonal event an anniversary keys its cutoff to. Half-anniversaries
    are always Summer; full anniversaries used New Year early (1.0/2.0) then
    switched to Valentine from 3.0 — a deliberate tightening of the cutoff window
    (Global replays JP accelerated, so New Year had fallen too far ahead of the
    campaign). The cadence held across 0.5..5.0."""
    if version.endswith(".5"):
        return "summer"
    return "new_year" if version in ("1.0", "2.0") else "valentine"


# Anniversaries that shipped NO trainee (★3) selector. Trainee selectors are a paid
# product, and the early/irregular ones (0.5, 1.5) had none. (Free-vs-paid pack
# acquisition detail is deferred to Yayoi's reward enrichment, not modelled here.)
_NO_TRAINEE_SELECTOR = {"0.5", "1.5"}


@digitan
@dataclass
class Selector(Entity):
    """A card-exchange voucher pool — "pick any card of `kind` from a list".

    An entity is simply its **name** and **what it's valid for**: the pool. The
    pool is a *recipe* the client expands — every `kind` card available up to and
    including the `cutoff` banner (by release order), minus `excludes`. The cutoff
    is the seasonal banner Cygames freezes the pool at, a few days before the
    anniversary campaign, withholding the most recent / scenario-link cards.

    Not scraped: a `Selector` mostly constructs itself from the timeline (see
    `Selectors._fetch_primary`). How it's *acquired* (free anniversary-mission
    grant vs paid packs) is the reward layer — Yayoi stamps that as a later
    enrichment, keeping it off the entity and out of the dependency graph.
    `excludes` defaults empty — a curated hatch for the rare un-selectable cards.
    """

    KEY_PREFIX: ClassVar[str] = "selector-"

    name: str  # display name, e.g. "Half Anniversary SSR Voucher"
    anniversary: StableKey  # the anniversary this selector belongs to
    kind: SelectorKind
    cutoff: StableKey  # banner key; pool = `kind` cards up to & incl this, minus excludes
    excludes: list[StableKey] = field(default_factory=list)

    def match(self, query: str) -> bool:
        q = query.lower()
        return (
            super().match(query)
            or q in self.name.lower()
            or q in self.anniversary.lower()
            or q in self.kind.value
        )


@digitan
class Selectors(Entities[Selector], metaclass=SingletonMeta):
    """Every anniversary selector, self-constructed from the timeline.

    For each `Anniversary`: pick its seasonal cutoff banner — the latest trainee
    banner before the anniversary that carries the season's costume variant AND is
    concurrent with a `Story` event (the story disambiguates multi-banner seasonal
    clusters). The paired support banner (`+1`) is the SSR-support pool cutoff; the
    variant trainee banner itself is the trainee-pool cutoff. Validated to
    reproduce the hand-built cutoff ledger across 0.5..5.0.
    """

    def search(self, query) -> list[Selector]:
        return super().search(query)

    def _validate_item(self, item: Selector) -> None:
        if not item.cutoff:
            logger.warning("Selector %s has no cutoff", item.key)

    def _fetch_primary(self) -> list[Selector]:
        # Cross-collection at the call site (deferred import breaks the
        # entities<->events cycle: events depend on entities).
        from horsetrader.models.events import (
            Anniversaries,
            Banners,
            Stories,
            TraineeBanner,
        )

        banners = Banners()
        story_dates = {
            d for s in Stories().values() if (d := _jst_date(s)) is not None
        }
        variant_banners = sorted(
            (b for b in banners.values() if isinstance(b, TraineeBanner)),
            key=_banner_num,
        )

        selectors: list[Selector] = []
        for anni in Anniversaries().values():
            anni_start = _jst(anni)
            if anni_start is None:
                logger.warning("Anniversary %s has no JST period; skipping", anni.key)
                continue
            version = anni.version
            wanted = _SEASON_VARIANTS[_season_for(version)]

            cutoff_banner = None
            for b in variant_banners:  # ascending id == release order
                b_start = _jst(b)
                if b_start is None or b_start >= anni_start:
                    continue
                if _jst_date(b) in story_dates and any(
                    t.variant.variant in wanted for t in b.contents
                ):
                    cutoff_banner = b  # keep the latest qualifying one before the anni
            if cutoff_banner is None:
                logger.warning(
                    "No seasonal cutoff banner found for %s (%s)",
                    anni.key, _season_for(version),
                )
                continue

            vid = _banner_num(cutoff_banner)
            tag = version.replace(".", "_")

            # SSR support — every anniversary. Pool cuts at the paired support
            # banner (variant trainee id + 1).
            selectors.append(
                Selector(
                    key=StableKey(f"selector-{tag}-ssr"),
                    name=f"{anni.name} SSR Voucher",
                    anniversary=anni.key,
                    kind=SelectorKind.SSR_SUPPORT,
                    cutoff=StableKey(f"banner-{vid + 1}"),
                )
            )

            # Trainee (★3) — only the anniversaries that shipped one. Pool cuts at
            # the seasonal trainee banner itself.
            if version not in _NO_TRAINEE_SELECTOR:
                selectors.append(
                    Selector(
                        key=StableKey(f"selector-{tag}-trainee"),
                        name=f"{anni.name} ★3 Voucher",
                        anniversary=anni.key,
                        kind=SelectorKind.TRAINEE,
                        cutoff=cutoff_banner.key,
                    )
                )

        return selectors


def _banner_num(banner) -> int:
    return int(banner.key.removeprefix("banner-"))


def _jst(event):
    """The event's JST period start — the JP release instant, ground truth and
    present for all banners/stories/anniversaries (JP is the substrate)."""
    return next((p.start for p in event.periods if p.tzinfo == JST), None)


def _jst_date(event):
    start = _jst(event)
    return start.date() if start is not None else None
