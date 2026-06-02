from abc import abstractmethod
from dataclasses import dataclass, field

from msgspec import UNSET

from horsetrader.core import Period, Periods
from horsetrader.models.core import TracenModel
from horsetrader.models.rewards import Rewards, rewards_to_baked
from horsetrader.output._records import EventRecord
from horsetrader.semantics import daitaku


@daitaku
@dataclass
class Event(TracenModel):
    """Semantic wrapper around `TracenModel` for event dataclasses, claimed by Daitaku.

    Unlike `Entity` (Digitan — who/what), `Event` is Daitaku — the *when*.
    Every concrete event carries `periods` — at most one `Period` per tzinfo
    (JST from extraction, UTC added at enrichment time, etc.), enforced
    by the `Periods` container. Re-runs are modeled as distinct events with
    their own stable keys, never as multiple periods on the same event.

    Shared model behaviour belongs in `TracenModel` by default. If something
    is genuinely event-only (the way `periods` is), it can land here;
    per-event behaviour belongs in concrete subclasses.
    """

    periods: Periods
    rewards: Rewards | None = field(default=None, kw_only=True)

    @abstractmethod
    def bake(self, period: Period) -> EventRecord:
        """Map this event to its wire record (`output/_records.py`) for the
        matched `period`.

        Abstract by contract — every concrete event owns its own record type,
        even if it adds nothing past the shared envelope (the same way `match`
        is abstract on `TracenModel`). The `type` discriminator is that record's
        msgspec tag, not something computed here. Concrete `bake`s build their
        record from `_envelope()` plus their own fields. `period` is passed in
        rather than read off `self` because an event carries one `Period` per tz
        and the caller picks which one (the EN/UTC one for the baked timeline).
        """
        ...

    def _envelope(self, period: Period) -> dict:
        """The shared record kwargs every concrete `bake` spreads in: the date
        span, the `predicted` flag, the stable key, and any curated rewards (a
        base `Event` field, so it folds in here rather than in four subclasses).

        Rewards is passed as `UNSET` when the event carries none, which drops
        the key from the output — the same omission the old dict-build got by
        skipping the assignment.
        """
        baked = rewards_to_baked(self.rewards)
        return {
            "start": period.start.date().isoformat(),
            "end": period.end.date().isoformat(),
            "predicted": period.predicted,
            "key": self.key,
            "rewards": baked if baked else UNSET,
        }


@daitaku
@dataclass
class RushableEvent(Event):
    """An event the player can *rush* — post it at its `start` for an efficiency
    penalty instead of farming it to the last day (banners, story events).

    Subclassing is the capability declaration: only these events carry the baked
    `rushable` key, so it never appears on an event that can't be rushed (an
    anchor, a Champions Meeting). The flag is ours to mark; the rushed-state
    *modelling* — the penalty, the start-post reschedule — is the client's
    projection job. Defaults `True` (the type *is* rushable); a member that
    shouldn't be can set it `False`."""

    rushable: bool = field(default=True, kw_only=True)

    def _envelope(self, period: Period) -> dict:
        return {**super()._envelope(period), "rushable": self.rushable}
