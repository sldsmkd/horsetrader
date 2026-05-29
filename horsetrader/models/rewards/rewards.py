from dataclasses import dataclass
from typing import ClassVar

from horsetrader.semantics import yayoi

from .items import Item, Items


@yayoi
class Reward:
    """An event handout — a typed value attached to an `Event`.

    Concrete subclasses carry their own payload shape (an `amount: int`
    for plain counters; whatever shape discovery settles on for the
    sequence-style reward). The class-level `key` is the name the reward
    serialises under in the baked JSON; `item_key` points into the
    `Items` collection so identity, JP/EN name, and icon come from a
    first-class Tracen model rather than a constant table.
    """

    key: ClassVar[str]
    item_key: ClassVar[str] = ""

    @classmethod
    def item(cls) -> Item | None:
        """Resolve this reward's `Item` (name + icon) via the Items singleton.

        Called at consume time (story-event resolution, bake), never at
        class load — the Items singleton's eager scrape has to be allowed
        to finish under Pipeline orchestration before any reward asks for
        its item.
        """
        if not cls.item_key:
            return None
        return Items().get(cls.item_key)


@yayoi
@dataclass(frozen=True)
class Carats(Reward):
    key: ClassVar[str] = "carats"
    item_key: ClassVar[str] = "item-00043"
    amount: int


@yayoi
@dataclass(frozen=True)
class TraineeTicket(Reward):
    key: ClassVar[str] = "trainee_ticket"
    item_key: ClassVar[str] = "item-00041"
    amount: int


@yayoi
@dataclass(frozen=True)
class SupportTicket(Reward):
    key: ClassVar[str] = "support_ticket"
    item_key: ClassVar[str] = "item-00111"
    amount: int


@yayoi
@dataclass(frozen=True)
class RainbowCrystalShard(Reward):
    key: ClassVar[str] = "rainbow_crystal_shard"
    item_key: ClassVar[str] = "item-00149"
    amount: int


@yayoi
@dataclass(frozen=True)
class GoldCrystalShard(Reward):
    key: ClassVar[str] = "gold_crystal_shard"
    item_key: ClassVar[str] = "item-00150"
    amount: int


@yayoi
class Rewards(list[Reward]):
    """In-event handouts attached to an `Event` — a list of typed `Reward`s.

    Heterogeneous on purpose: plain counter rewards (`Carats`, the scout
    tickets, gold shards) sit alongside the still-being-scoped
    sequence-shaped reward without anything special-casing them at the
    container level. The bake step folds the list into the
    `{key: value}` JSON object by reading each entry's `key`.

    No `TracenModel` scaffolding (no stable key, no references): a
    `Rewards` is a value attached to an event, not an entity in its own
    right.
    """


def reward_for_gametora_icon(icon_id: str) -> type[Reward] | None:
    """Resolve a Gametora `item_icon_<ID>.png` anchor to the Reward class
    it represents, or `None` if no known subclass claims it. Walks
    `Reward.__subclasses__()` so new subclasses register themselves on
    class definition. The lookup is `item_key`-shaped now (`item-00043`)
    so it goes through the same key space `Items` uses.
    """
    if not icon_id:
        return None
    item_key = f"item-{icon_id}"
    for cls in Reward.__subclasses__():
        if cls.item_key == item_key:
            return cls
    return None
