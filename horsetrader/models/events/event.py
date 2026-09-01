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
    _flag_overrides: dict[str, bool] = field(
        default_factory=dict, init=False, repr=False
    )

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
        """The shared record kwargs every concrete `bake` spreads in: the period
        instants, the `predicted` flag, the stable key, and any curated rewards
        (a base `Event` field, so it folds in here rather than in four
        subclasses).

        Rewards is passed as `UNSET` when the event carries none, which drops
        the key from the output — the same omission the old dict-build got by
        skipping the assignment.
        """
        baked = rewards_to_baked(self.rewards)
        envelope = {
            "start": period.start.isoformat(),
            "end": period.end.isoformat(),
            "predicted": period.predicted,
            "key": self.key,
            "rewards": baked if baked else UNSET,
        }
        if not self.visible:
            envelope["visible"] = False
        if self.rushable:
            envelope["rushable"] = True
        return envelope

    def _flag(self, name: str, default: bool) -> bool:
        return self._flag_overrides.get(name, default)

    @property
    def visible(self) -> bool:
        return self._flag("visible", True)

    @property
    def rushable(self) -> bool:
        return self._flag("rushable", False)

    @property
    def predictable(self) -> bool:
        """Whether a JP occurrence may be projected onto the EN timeline.

        The default is deliberately permissive: the sparse curated override is
        for documented JP-only occurrences, not for merely unconfirmed EN ones.
        This is model-only curation and never crosses the bake contract.
        """
        return self._flag("predictable", True)

    def apply_flags(self, flags: dict[str, bool]) -> None:
        """Apply curated optional event flags to this model."""
        self._flag_overrides.update(flags)


@daitaku
class Rushable:
    """Mixin for events the player can *rush*.

    Composition is the authoring-side capability declaration. On the wire the
    flag is presence-encoded: `rushable: true` appears only for events that can
    be rushed, while absence means the shared contract default (`false`). The
    rushed-state *modelling* — the persisted choice and start-post reschedule —
    is the client's projection job.
    """

    @property
    def rushable(self) -> bool:
        return self._flag("rushable", True)


@daitaku
class Invisible:
    """Mixin for events hidden from the timeline unless curated otherwise."""

    @property
    def visible(self) -> bool:
        return self._flag("visible", False)
