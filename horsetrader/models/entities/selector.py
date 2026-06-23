from dataclasses import dataclass, field
from enum import Enum
from typing import ClassVar

from horsetrader.core import JST, SingletonMeta, StableKey
from horsetrader.enums import CostumeVariants
from horsetrader.info import Logger
from horsetrader.semantics import digitan

from .entities import Entities
from .entity import Entity
from .trainee import Trainee

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
            SupportBanner,
            TraineeBanner,
        )

        banners = list(Banners().values())
        support_banners = [b for b in banners if isinstance(b, SupportBanner)]
        trainee_banners = sorted(
            (b for b in banners if isinstance(b, TraineeBanner)), key=_banner_num
        )
        stories = [s for s in Stories().values() if _jst(s) is not None]

        selectors: list[Selector] = []
        for anni in Anniversaries().values():
            anni_start = _jst(anni)
            if anni_start is None:
                logger.warning("Anniversary %s has no JST period; skipping", anni.key)
                continue
            version = anni.version
            season = _season_for(version)
            wanted = _SEASON_VARIANTS[season]

            # The trainee-pool cutoff is the seasonal trainee banner: the latest one
            # before the anniversary featuring the season's costume variant AND tied
            # to a Story (`Story.promotes` — the bonus-table colink correlation). The
            # story tie cleanly excludes mixed-variant rerun banners that merely
            # re-include a seasonal card; we keep the story that promotes it.
            trainee_cutoff = None
            cutoff_story = None
            for b in trainee_banners:  # ascending id == release order
                b_start = _jst(b)
                if b_start is None or b_start >= anni_start:
                    continue
                if not any(
                    isinstance(t, Trainee) and t.variant.variant in wanted
                    for t in b.contents
                ):
                    continue
                story = next((s for s in stories if s.promotes(b)), None)
                if story is not None:
                    trainee_cutoff, cutoff_story = b, story  # keep the latest before anni
            if trainee_cutoff is None or cutoff_story is None:
                logger.warning("No seasonal (%s) trainee banner before %s", season, anni.key)
                continue

            # The SSR-support pool cutoff is the support banner the SAME story
            # promotes — its Event-Point-Bonus top-tier support cast (`promotes`
            # against `link_supports`). No id arithmetic, no temporal pairing.
            ssr_cutoff = _latest(sb for sb in support_banners if cutoff_story.promotes(sb))
            if ssr_cutoff is None:
                logger.warning(
                    "Story %s promotes no support banner (anni %s)",
                    cutoff_story.key, anni.key,
                )
                continue

            tag = version.replace(".", "_")

            # SSR support — every anniversary.
            selectors.append(
                Selector(
                    key=StableKey(f"selector-{tag}-ssr"),
                    name=f"{anni.name} SSR Voucher",
                    anniversary=anni.key,
                    kind=SelectorKind.SSR_SUPPORT,
                    cutoff=ssr_cutoff.key,
                )
            )

            # Trainee (★3) — only the anniversaries that shipped one.
            if version not in _NO_TRAINEE_SELECTOR:
                selectors.append(
                    Selector(
                        key=StableKey(f"selector-{tag}-trainee"),
                        name=f"{anni.name} ★3 Voucher",
                        anniversary=anni.key,
                        kind=SelectorKind.TRAINEE,
                        cutoff=trainee_cutoff.key,
                    )
                )

        return selectors


def _latest(banners):
    """The highest-id (latest-released) banner in an iterable, or None if empty.
    A story promotes exactly its paired banner of each kind, so this is just a
    safe disambiguator should `promotes` ever match more than one."""
    candidates = list(banners)
    return max(candidates, key=_banner_num) if candidates else None


def _banner_num(banner) -> int:
    return int(banner.key.removeprefix("banner-"))


def _jst(event):
    """The event's JST period start — the JP release instant, ground truth and
    present for all banners/stories/anniversaries (JP is the substrate)."""
    return next((p.start for p in event.periods if p.tzinfo == JST), None)
