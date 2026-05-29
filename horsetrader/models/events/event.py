from dataclasses import dataclass, field

from horsetrader.core import Periods
from horsetrader.models.core import TracenModel
from horsetrader.models.rewards import Rewards
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
