import re
from dataclasses import dataclass
from typing import cast

from horsetrader.core import StableKey
from horsetrader.extractors.static import Static
from horsetrader.info import Logger
from horsetrader.models.core import TracenObject
from horsetrader.output._records import Baked
from horsetrader.semantics import yayoi

from .rewards import Rewards, rewards_from_baked, rewards_to_baked

logger = Logger.get(__name__)


@yayoi
@dataclass
class RewardStructure(TracenObject):
    """A standing reward *recipe* — a stable key and its per-occurrence `Rewards`.

    Not an Entity (a recipe, not a thing in the world) and not an event payload:
    it's config addressed by stable key, baked to `config.json`. The ETL owns the
    *numbers* (the per-occurrence `rewards`); the client owns the *cadence* — how
    often the recipe pays and when — keyed off the structure's identity. So the
    `dailies` structure bakes only `[FreeCarats(75)]`; the daily cadence is the
    client's to fill.

    `key` is inherited from `TracenObject`. No graph machinery (`references` /
    `match`): a structure has identity, but nothing in the timeline references it.
    """

    rewards: Rewards

    def bake(self) -> Baked:
        """The baked-rewards object this structure serialises to under its key —
        the same shape an event's `rewards` carries (`rewards_to_baked`)."""
        baked = rewards_to_baked(self.rewards)
        if baked is None:
            raise ValueError(f"reward structure {self.key!r} has no rewards")
        # `rewards_to_baked` is typed loosely (`dict[str, object]`); the value it
        # emits *is* the `Baked` wire shape — narrow it at this serialisation seam.
        return cast(Baked, baked)


@yayoi
@dataclass
class RewardMap(TracenObject):
    """A *rank-graded* reward — each rank maps to its own `RewardStructure`.

    Team Trials is the first: a weekly income that depends on your class (Class
    1–6, plus the half-step `5.5` "flapping" tier). Like a `RewardStructure` it's
    keyed config baked to `config.json`, but the payout is *selected by rank*
    rather than fixed — and *which* rank is the client's call (sweatiness /
    account state), not ours; see #19. Bakes under `reward_maps`, each rank → its
    structure's baked rewards.

    `tiers` is keyed by the rank *label* (`"1"`, …, `"5.5"`, `"6"`); the nested
    `RewardStructure`s carry derived stable keys (`_tier_key`) so each is a proper
    `TracenObject`, but the wire map keys by the rank label.
    """

    tiers: dict[str, RewardStructure]

    def bake(self) -> dict[str, Baked]:
        return {rank: structure.bake() for rank, structure in self.tiers.items()}


def _tier_slug(rank: str) -> str:
    """Slugify a rank label for a stable key — lowercase, `+` spelled out (so
    `S+` and `S` stay distinct), every other non-alphanumeric run to a dash."""
    s = rank.lower().replace("+", "-plus")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def _tier_key(map_key: StableKey, rank: str) -> StableKey:
    """Derive a tier `RewardStructure`'s stable key from its map + rank, e.g.
    (`reward-map-team-trials`, `5.5`) → `reward-structure-team-trials-5-5`,
    (`reward-map-club-rank`, `S+`) → `reward-structure-club-rank-s-plus`."""
    body = map_key.removeprefix("reward-map-")
    return StableKey(f"reward-structure-{body}-{_tier_slug(rank)}")


def load_reward_structures() -> dict[StableKey, RewardStructure]:
    """Build the flat curated reward structures, keyed by stable key.

    The curated extractor returns each entry's baked-shape `rewards`; Yayoi owns
    the construction (the baked dict → a `Rewards`). Curated data fails loud, so a
    malformed entry has already raised in the extractor.
    """
    out: dict[StableKey, RewardStructure] = {}
    for raw_key, entry in Static().reward_structures().items():
        key = StableKey(raw_key)
        out[key] = RewardStructure(key=key, rewards=rewards_from_baked(entry["rewards"]))
    logger.info("Built %d reward structures", len(out))
    return out


def load_reward_maps() -> dict[StableKey, RewardMap]:
    """Build the rank-graded reward maps, keyed by stable key. Each tier becomes a
    `RewardStructure` with a key derived from the map + rank (`_tier_key`); the
    map itself keys by the rank label."""
    out: dict[StableKey, RewardMap] = {}
    for raw_key, entry in Static().reward_maps().items():
        key = StableKey(raw_key)
        tiers = {
            str(rank): RewardStructure(
                key=_tier_key(key, str(rank)), rewards=rewards_from_baked(rewards)
            )
            for rank, rewards in entry["tiers"].items()
        }
        out[key] = RewardMap(key=key, tiers=tiers)
    logger.info("Built %d reward maps", len(out))
    return out
