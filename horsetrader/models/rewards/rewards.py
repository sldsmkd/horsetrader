from collections.abc import Iterator
from dataclasses import dataclass, replace
from typing import ClassVar, Self

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
class CounterReward(Reward):
    """A plain counter handout — a fixed `amount` of a single item.

    Most in-event rewards (carats, the scout tickets, crystal shards)
    differ only in `key`/`item_key`; they share this `amount: int` payload
    so the bake step and `RewardGenerator` can treat any of them uniformly
    rather than re-declaring the field five times over.

    Counters of the *same* type add and scale by amount — `Carats(150) +
    Carats(150) == Carats(300)`, `Carats(150) * 5 == Carats(750)` — which
    is what lets the bake step fold a list and `RewardGenerator` compute a
    total without caring which counter it's holding.
    """

    amount: int

    def __add__(self, other: Self) -> Self:
        if type(self) is not type(other):
            return NotImplemented
        return replace(self, amount=self.amount + other.amount)

    def __mul__(self, times: int) -> Self:
        return replace(self, amount=self.amount * times)


@yayoi
@dataclass(frozen=True)
class Carats(CounterReward):
    key: ClassVar[str] = "carats"
    item_key: ClassVar[str] = "item-00043"


@yayoi
@dataclass(frozen=True)
class TraineeTicket(CounterReward):
    key: ClassVar[str] = "trainee_tickets"
    item_key: ClassVar[str] = "item-00041"


@yayoi
@dataclass(frozen=True)
class SupportTicket(CounterReward):
    key: ClassVar[str] = "support_tickets"
    item_key: ClassVar[str] = "item-00111"


@yayoi
@dataclass(frozen=True)
class RainbowCrystalShard(CounterReward):
    key: ClassVar[str] = "rainbow_crystal_shards"
    item_key: ClassVar[str] = "item-00149"


@yayoi
@dataclass(frozen=True)
class GoldCrystalShard(CounterReward):
    key: ClassVar[str] = "gold_crystal_shards"
    item_key: ClassVar[str] = "item-00150"


@yayoi
@dataclass(frozen=True)
class RewardGenerator(Reward):
    """A reward handed out on repeat — typically a daily login bonus that
    pays out once per run-day over an event's span.

    Wraps a single `Reward` and a `repeat` count. The *cadence* (which
    days it pays, when each instalment unlocks) is the client's concern,
    not ours; we only carry the unit reward and how many times it lands.
    `total()` collapses the schedule into one Reward of `amount * repeat`
    for callers that only want the headline figure.
    """

    key: ClassVar[str] = "generator"
    reward: CounterReward
    repeat: int

    def total(self) -> CounterReward:
        return self.reward * self.repeat


@yayoi
@dataclass(frozen=True)
class SequenceReward(Reward):
    """A daily-login-bonus schedule for a *single* counter type: per login-day,
    an amount of that type, or `None` for a day it isn't paid.

    The type is fixed across the sequence, so a skip is the *absence of the
    type* — `Null` in curated YAML, `None` here, not `0`. Anniversary login
    tables pay every day, but some days hand out a welfare/support card we don't
    track; those days are `None`. A second type we *did* track wouldn't fold in
    here — it'd be its own `SequenceReward`. `reward_type` is a plain
    `CounterReward` subclass (never a sequence or generator); the event stays
    open indefinitely, so the ETL models no end. `total()` sums the paying days.
    """

    key: ClassVar[str] = "sequence"
    reward_type: type[CounterReward]
    sequence: tuple[int | None, ...]

    def total(self) -> CounterReward:
        return self.reward_type(sum(a for a in self.sequence if a is not None))


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


def _reward_subclasses(root: type[Reward] = Reward) -> Iterator[type[Reward]]:
    """Every Reward subclass, depth-first. Recurses so intermediate bases
    like `CounterReward` don't hide the concrete rewards beneath them from
    the icon lookup.
    """
    for cls in root.__subclasses__():
        yield cls
        yield from _reward_subclasses(cls)


def reward_for_key(key: str) -> type[Reward] | None:
    """Resolve a serialised reward `key` (e.g. `"carats"`) to the Reward class
    that bakes under it, or `None`. Walks the subclass tree so new rewards
    register on definition; intermediate bases like `CounterReward` carry no
    `key` and so never match.
    """
    for cls in _reward_subclasses():
        if getattr(cls, "key", "") == key:
            return cls
    return None


def _counter_from_baked(key: str, amount: object, where: str) -> CounterReward:
    cls = reward_for_key(key)
    if cls is None or not issubclass(cls, CounterReward):
        raise ValueError(f"{where}: unknown counter reward key {key!r}")
    if not isinstance(amount, int):
        raise ValueError(f"{where}: reward {key!r} amount must be an int; got {amount!r}")
    return cls(amount)


def _generator_from_baked(value: object) -> RewardGenerator:
    key = RewardGenerator.key
    if not isinstance(value, dict):
        raise ValueError(f"{key} must be a mapping; got {value!r}")
    body = dict(value)
    if "repeat" not in body:
        raise ValueError(f"{key} is missing 'repeat'")
    repeat = body.pop("repeat")
    if not isinstance(repeat, int):
        raise ValueError(f"{key} repeat must be an int; got {repeat!r}")
    if len(body) != 1:
        raise ValueError(
            f"{key} needs exactly one unit reward; got {list(body)}"
        )
    (rkey, amount), = body.items()
    return RewardGenerator(
        reward=_counter_from_baked(rkey, amount, key), repeat=repeat
    )


def _sequence_from_baked(value: object) -> SequenceReward:
    key = SequenceReward.key
    if not isinstance(value, dict):
        raise ValueError(f"{key} must be a mapping; got {value!r}")
    body = dict(value)
    if "type" not in body:
        raise ValueError(f"{key} is missing 'type'")
    if "sequence" not in body:
        raise ValueError(f"{key} is missing 'sequence'")
    type_key = body.pop("type")
    steps = body.pop("sequence")
    if body:
        raise ValueError(f"{key} has unexpected keys {list(body)}")
    cls = reward_for_key(type_key) if isinstance(type_key, str) else None
    if cls is None or not issubclass(cls, CounterReward):
        raise ValueError(f"{key} type must be a counter reward; got {type_key!r}")
    if not isinstance(steps, list):
        raise ValueError(f"{key} 'sequence' must be a list; got {steps!r}")
    amounts: list[int | None] = []
    for step in steps:
        # `Null` (or a bare `0`) — the type isn't paid that day; an unmodelled
        # welfare-card day, an *absence* of the type rather than zero of it.
        if step is None or step == 0:
            amounts.append(None)
        elif isinstance(step, int):
            amounts.append(step)
        else:
            raise ValueError(f"{key} step must be an int or null; got {step!r}")
    return SequenceReward(reward_type=cls, sequence=tuple(amounts))


def rewards_from_baked(data: dict[str, object]) -> Rewards:
    """Build a `Rewards` from the baked `{key: value}` shape — the inverse of
    `rewards_to_baked`. Plain `{key: amount}` entries become
    the matching `CounterReward`; a `generator` object becomes a
    `RewardGenerator`. The two must stay in sync: this is what lets curated
    `static/*.yaml` carry rewards written in the same shape the client reads.

    Raises on an unknown key or malformed shape — curated static data fails
    loud so the pipeline run is the editor's feedback loop (see
    [[feedback_curated_yaml_fails_loud]]).
    """
    rewards = Rewards()
    for key, value in data.items():
        if key == RewardGenerator.key:
            rewards.append(_generator_from_baked(value))
        elif key == SequenceReward.key:
            rewards.append(_sequence_from_baked(value))
        else:
            rewards.append(_counter_from_baked(key, value, "rewards"))
    return rewards


def rewards_to_baked(rewards: "Rewards | None") -> dict[str, object] | None:
    """Fold a `Rewards` list into the baked `{key: value}` shape — the inverse
    of `rewards_from_baked`, and what `Event.bake` stamps under `rewards`.

    Same-keyed counters sum, so callers can stamp `[Carats(80), Carats(80)]`
    *or* `[Carats(160)]` and get the same output. A `RewardGenerator` keeps its
    repeat structure rather than being summed away — the client owns the payout
    cadence — so it serialises under `generator` as a `{<reward key>:
    amount, "repeat": n}` object. One generator per event (a weekly, new-player,
    and holiday bonus that overlap are three separate events), so a single
    object, not a list. Returns `None` for an empty/absent `Rewards` so callers
    can drop the key entirely.
    """
    if not rewards:
        return None
    counters: dict[str, int] = {}
    generator: dict[str, object] | None = None
    sequence: dict[str, object] | None = None
    for r in rewards:
        if isinstance(r, RewardGenerator):
            generator = {r.reward.key: r.reward.amount, "repeat": r.repeat}
            continue
        if isinstance(r, SequenceReward):
            sequence = {"type": r.reward_type.key, "sequence": list(r.sequence)}
            continue
        amount = getattr(r, "amount", None)
        if amount is None:
            continue
        counters[r.key] = counters.get(r.key, 0) + amount
    out: dict[str, object] = dict(counters)
    if generator is not None:
        out[RewardGenerator.key] = generator
    if sequence is not None:
        out[SequenceReward.key] = sequence
    return out or None


def reward_for_gametora_icon(icon_id: str) -> type[CounterReward] | None:
    """Resolve a Gametora `item_icon_<ID>.png` anchor to the `CounterReward`
    class it represents, or `None` if no known subclass claims it. Walks the
    Reward subclass tree so new subclasses register themselves on class
    definition. The lookup is `item_key`-shaped now (`item-00043`) so it
    goes through the same key space `Items` uses.

    A scraped icon is always "N of an item", so the match is constrained to
    `CounterReward` (the only rewards that carry an `amount`) — the same
    `issubclass` narrowing `_counter_from_baked` uses. In practice only the
    concrete counters set an `item_key`, but the guard keeps callers sound: a
    future non-counter reward that happened to carry one is skipped, never
    constructed with an `amount` it doesn't have.
    """
    if not icon_id:
        return None
    item_key = f"item-{icon_id}"
    for cls in _reward_subclasses():
        if cls.item_key == item_key and issubclass(cls, CounterReward):
            return cls
    return None
