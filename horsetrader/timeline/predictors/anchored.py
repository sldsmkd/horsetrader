from horsetrader.core import UTC, Period
from horsetrader.models.events import AnchoredEvent
from horsetrader.models.events.anchored import AnchorSpec, resolve_anchored
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor


@matikanefukukitaru
class AnchorPredictor(Predictor):
    """Derive EN/UTC dates for AnchoredEvents from their anchor's UTC date.

    An anchored event's launch is a fixed offset from one edge of its anchor —
    so once the anchor carries a UTC period (confirmed by Transcend, or
    predicted by an earlier predictor), the campaign's UTC follows by the same
    arithmetic used for JST at load. Runs *last* so every base anchor has had
    its shot at a UTC date first, and resolves whole chains in one pass.

    Unlike the load-time JST pass, a missing anchor UTC here is not fatal: the
    base anchor simply wasn't predictable, so its campaigns stay unpredicted
    (counted by `Predict` like any other) rather than raising.
    """

    def predict(self, timeline: Timeline) -> int:
        by_key = {e.key: e for e in timeline}

        def base_utc(key: str) -> Period | None:
            event = by_key.get(key)
            if event is None:
                return None
            return next((p for p in event.periods if p.tzinfo == UTC), None)

        specs = {
            e.key: AnchorSpec(e.anchor, e.relation, e.duration)
            for e in timeline
            if isinstance(e, AnchoredEvent)
            and not any(p.tzinfo == UTC for p in e.periods)
        }
        if not specs:
            return 0

        resolved, _unresolved = resolve_anchored(specs, base_utc)
        for key, period in resolved.items():
            by_key[key].periods.append(period)
        return len(resolved)
