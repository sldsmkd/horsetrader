"""Yayoi's reward-attachment policies.

Rules decide which `Reward` instances land on which events. They live in
their own module so policy stays separate from event identity — adding a
new policy is a new function here, not edits to event aggregators.

Event-type imports are deferred to function bodies because
`models/events/event.py` imports `Rewards` from this package; resolving
event types at module load would close the cycle. Inside a function
body the events package is fully loaded by the time a rule runs.
"""

from typing import TYPE_CHECKING

from horsetrader.enums import CostumeVariants
from horsetrader.info import Logger

from .rewards import Carats, GoldCrystalShard, Rewards

if TYPE_CHECKING:
    from horsetrader.models.events import Banner, Story


logger = Logger.get(__name__)


def stamp_first_original_rewards(banners: "list[Banner]") -> None:
    """A trainee's Original-variant debut banner grants carats.

    Approximates the in-game "new trainee" bonus by treating the *earliest*
    banner that pickups a given DEFAULT-variant trainee as that trainee's
    debut. Each debut stamps 80 carats (4 newly-unlocked stories at the
    in-game payout); banners that debut multiple Originals stack carats.
    Reruns, costume variants, and non-trainee banners are skipped by
    construction.
    """
    from datetime import datetime

    from horsetrader.core import StableKey
    from horsetrader.models.entities import Trainee
    from horsetrader.models.events import TraineeBanner

    earliest: dict[StableKey, tuple[datetime, TraineeBanner]] = {}
    for b in banners:
        if not isinstance(b, TraineeBanner) or not b.periods:
            continue
        start = min(p.start for p in b.periods)
        for c in b.contents:
            if not isinstance(c, Trainee):
                continue
            if c.variant.variant != CostumeVariants.DEFAULT:
                continue
            existing = earliest.get(c.key)
            if existing is None or existing[0] > start:
                earliest[c.key] = (start, b)

    debut_counts: dict[int, tuple[TraineeBanner, int]] = {}
    for _, banner in earliest.values():
        ident = id(banner)
        if ident in debut_counts:
            b, count = debut_counts[ident]
            debut_counts[ident] = (b, count + 1)
        else:
            debut_counts[ident] = (banner, 1)

    for banner, count in debut_counts.values():
        banner.rewards = Rewards([Carats(80 * count)])


def stamp_story_off_table_extras(stories: "list[Story]") -> None:
    """Every story event grants 660 carats + 3 gold shards on top of its
    scraped Point Rewards table.

    Gametora's table doesn't list the off-table extras: 450 carats from
    the spin-the-wheel roulette + 210 carats from the post-event mission,
    and 3 gold crystal shards that aren't itemised on the page. They're
    consistent across every story event ingested so far, so they're
    stamped uniformly. If a future event breaks the consistency, this is
    where the rule splits.
    """
    for s in stories:
        if s.rewards is None:
            s.rewards = Rewards()
        s.rewards.append(Carats(660))
        s.rewards.append(GoldCrystalShard(3))
