"""Yayoi's reward-attachment policies.

Rules decide which `Reward` instances land on which events. They live in
their own module so policy stays separate from event identity — adding a
new policy is a new function here, not edits to event aggregators.

Event-type imports are deferred to function bodies because
`models/events/event.py` imports `Rewards` from this package; resolving
event types at module load would close the cycle. Inside a function
body the events package is fully loaded by the time a rule runs.
"""

from collections.abc import Iterable
from typing import TYPE_CHECKING

from horsetrader.enums import CostumeVariants
from horsetrader.info import Logger

from .rewards import (
    FreeCarats,
    GoldCrystalShard,
    RainbowCrystalShard,
    Rewards,
    SequenceReward,
    SupportTicket,
    TraineeTicket,
)

if TYPE_CHECKING:
    from horsetrader.models.events import Banner, LegendRace, Story, WikiruEvent


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
        banner.rewards = Rewards([FreeCarats(80 * count)])


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
        s.rewards.append(FreeCarats(660))
        s.rewards.append(GoldCrystalShard(3))


def stamp_skill_test_rewards(skill_tests: "Iterable[WikiruEvent]") -> None:
    """Every Trainer Skills Test grants the same fixed, full-clear reward set.

    The event follows one settled pattern across occurrences (wikiru stopped
    itemising after the 5th once it was clearly fixed), so the ceiling is
    stamped uniformly rather than curated per occurrence. Two sources, summed
    into the carat total:

    - **Trial Coin exchange** (max-clear, carat-economy items only): Jewels
      150 × 3 = 450 carats, 1 rainbow + 1 gold crystal shard, 3 trainee +
      3 support gacha tickets. The coins themselves and non-economy items
      (manie, support/friend points) aren't tracked.
    - **7 escalating challenges**: 800 carats for completing all of them.

    Non-carat-economy exchange items are out by the same rule that drops them
    from Showtime. If a future occurrence breaks the pattern, this is where
    the rule splits.
    """
    for st in skill_tests:
        st.rewards = Rewards([
            FreeCarats(1250),  # 450 exchange Jewels (150×3) + 800 from clearing all 7 challenges
            RainbowCrystalShard(1),
            GoldCrystalShard(1),
            TraineeTicket(3),
            SupportTicket(3),
        ])


def stamp_racing_carnival_rewards(carnivals: "Iterable[WikiruEvent]") -> None:
    """Every Racing Carnival grants the same fixed reward set."""
    for c in carnivals:
        c.rewards = Rewards([
            FreeCarats(850),
            RainbowCrystalShard(2),
            GoldCrystalShard(2),
            TraineeTicket(3),
            SupportTicket(3),
        ])


def stamp_legend_race_rewards(races: "Iterable[LegendRace]") -> None:
    """Stamp each Legend Race's reward heuristic.

    The carat payout is temporal, not a lump sum: **250 carats land on the first
    day of each set** (leg), nothing in between — so it's modelled as a
    `SequenceReward(FreeCarats)` over the race's JST window, with 250 at each leg's
    first-day offset and `None` for the off days. The day offsets are taken from
    the JST legs (the same basis `LegendRace._baked_legs` re-anchors onto the EN
    window), so the sequence index lines up with the baked legs.

    On top of the carats: from the 8th occurrence onward (when the reward tier
    improved) every race also grants 2 gold + 1 rainbow crystal shard, awarded at
    the end — plain counters, since the envelope doesn't position them by day.
    """
    from horsetrader.core import JST

    for race in races:
        jp = next((p for p in race.periods if p.tzinfo == JST), None)
        if jp is not None and jp.span and race.legs:
            span_days = (jp.end.date() - jp.start.date()).days + 1
            sequence: list[int | None] = [None] * span_days
            for leg in race.legs:
                offset = (leg.period.start.date() - jp.start.date()).days
                if 0 <= offset < span_days:
                    sequence[offset] = 250
            rewards = Rewards(
                [SequenceReward(reward_type=FreeCarats, sequence=tuple(sequence))]
            )
        else:
            # No JST anchor (shouldn't happen): fall back to the lump total.
            rewards = Rewards([FreeCarats(250 * len(race.legs))])

        ordinal = int(str(race.key).rsplit("-", 1)[-1])
        if ordinal >= 8:
            rewards.append(GoldCrystalShard(2))
            rewards.append(RainbowCrystalShard(1))
        race.rewards = rewards


def stamp_factor_studies_rewards(studies: "Iterable[WikiruEvent]") -> None:
    """Every Agnes Tachyon Factor Studies occurrence grants the same fixed set.

    The movie-tie-in variant (劇場版… in JP) is the same event under a renamed
    banner — same payout, so it's stamped uniformly like the rest.
    """
    for s in studies:
        s.rewards = Rewards([
            FreeCarats(900),
            RainbowCrystalShard(1),
            GoldCrystalShard(1),
        ])
