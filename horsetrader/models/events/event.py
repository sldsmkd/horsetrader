from abc import abstractmethod
from dataclasses import dataclass, field

from horsetrader.core import Period, Periods
from horsetrader.models.core import TracenModel
from horsetrader.models.rewards import Rewards, rewards_to_baked
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
    def bake(self, period: Period) -> dict:
        """Serialise this event to its wire record for the matched `period`.

        Abstract by contract — every concrete event owns its own wire shape,
        even if it adds nothing past the shared envelope (the same way `match`
        is abstract on `TracenModel`). The body here is the base case, callable
        via `super().bake(period)`: the date span, the `predicted` flag, the
        class-derived `type` discriminator, the stable key, and any curated
        rewards (a base `Event` field, so it lands here rather than in four
        subclasses). `period` is passed in rather than read off `self` because
        an event carries one `Period` per tz and the caller picks which one
        (the EN/UTC one for the baked timeline).
        """
        out: dict = {
            "start": period.start.date().isoformat(),
            "end": period.end.date().isoformat(),
            "predicted": period.predicted,
            "type": type(self).__name__.lower(),
            "key": self.key,
        }
        if rewards := rewards_to_baked(self.rewards):
            out["rewards"] = rewards
        return out
