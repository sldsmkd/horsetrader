from dataclasses import dataclass
from typing import ClassVar

from horsetrader.semantics import yayoi

# TODO: replace the hand-curated Gametora icon-id mapping below by scraping
# https://gametora.com/ja/umamusume/items and
# https://gametora.com/umamusume/items so item identity + names + JP/EN
# titles become a first-class Tracen model rather than a constant table.


@yayoi
class Reward:
    """An event handout — a typed value attached to an `Event`.

    Concrete subclasses carry their own payload shape (an `amount: int`
    for plain counters; whatever shape discovery settles on for the
    sequence-style reward). The class-level `key` is the name the reward
    serialises under in the baked JSON; `gametora_icon_id` is the
    `item_icon_<ID>.png` anchor Gametora uses on event pages, or `""`
    when the reward never surfaces on a scraped table.
    """

    key: ClassVar[str]
    gametora_icon_id: ClassVar[str] = ""


@yayoi
@dataclass(frozen=True)
class Carats(Reward):
    key: ClassVar[str] = "carats"
    gametora_icon_id: ClassVar[str] = "00043"
    amount: int


@yayoi
@dataclass(frozen=True)
class TraineeTicket(Reward):
    key: ClassVar[str] = "trainee_ticket"
    gametora_icon_id: ClassVar[str] = "00041"
    amount: int


@yayoi
@dataclass(frozen=True)
class SupportTicket(Reward):
    key: ClassVar[str] = "support_ticket"
    gametora_icon_id: ClassVar[str] = "00111"
    amount: int


@yayoi
@dataclass(frozen=True)
class RainbowShards(Reward):
    key: ClassVar[str] = "rainbow_shards"
    gametora_icon_id: ClassVar[str] = "00149"
    amount: int


@yayoi
@dataclass(frozen=True)
class GoldShards(Reward):
    key: ClassVar[str] = "gold_shards"
    gametora_icon_id: ClassVar[str] = "00150"
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
    class definition.
    """
    if not icon_id:
        return None
    for cls in Reward.__subclasses__():
        if cls.gametora_icon_id == icon_id:
            return cls
    return None
