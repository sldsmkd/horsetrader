from dataclasses import dataclass

from horsetrader.core import Period
from horsetrader.models.core import TracenModel
from horsetrader.semantics import daitaku


@daitaku
@dataclass
class Event(TracenModel):
    """Semantic wrapper around `TracenModel` for event dataclasses, claimed by Daitaku.

    DO NOT ADD CODE HERE. This class exists only to give event dataclasses a
    name in the conventional `models/events/` namespace that matches the
    `Events` collection wrapper. All shared model behavior belongs in
    `TracenModel`; per-event behavior belongs in concrete subclasses.

    Unlike `Entity` (Digitan — who/what), `Event` is Daitaku — the *when*.
    Every concrete event carries `periods` — one or more `Period` runs in
    the event's native timezone.
    """

    periods: list[Period]
