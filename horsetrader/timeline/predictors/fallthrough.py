from datetime import datetime

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger
from horsetrader.semantics import matikanefukukitaru

from ..datemapper import DateMapper
from ..timeline import Timeline
from .base import Predictor

logger = Logger.get(__name__)


@matikanefukukitaru
class FallthroughPredictor(Predictor):
    """Last-resort predictor for events no dedicated pass could place.

    Runs at the very end of the chain. Builds a `DateMapper` from every event
    already carrying both a JP and a UTC period (confirmed, or predicted by an
    earlier pass), then maps the JP day of anything still missing a UTC period
    through it. Cross-type by design — the JST→UTC server warp is shared, so a
    stray story can ride banner/scenario anchors and vice versa.

    No weekday snap, no per-type signal: it's the catch-all bucket, and the
    `DateMapper` round-to-nearest-day is good enough for things that fell
    through everything else. The more the passes above schedule, the more
    local slopes this has to interpolate against — accuracy rises as the
    timeline fills in. Lower confidence than the dedicated passes; it only
    ever sees what they left behind.
    """

    def predict(self, timeline: Timeline) -> int:
        mapper = DateMapper(JST, UTC)
        for event in self._timeline:
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            en = next((p for p in event.periods if p.tzinfo == UTC), None)
            if jp and en:
                mapper.add(jp.start, en.start)

        count = 0
        for event in self._timeline:
            if any(p.tzinfo == UTC for p in event.periods):
                continue
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            if jp is None:
                continue
            try:
                day = mapper.predict(jp.start, UTC)
            except ValueError:
                continue  # fewer than 2 anchors yet — nothing to interpolate from
            event.periods.append(Period(
                start=datetime(day.year, day.month, day.day, 22, tzinfo=UTC),
                span=jp.span,
                predicted=True,
            ))
            # Surfaced per-event on purpose: every line here is something no
            # dedicated pass placed. Add a mapper/predictor for it, or accept the
            # generic interpolation — but don't let it pass silently.
            logger.warning(
                "%s %s (JP %s) fell through to the generic DateMapper -> EN %s",
                type(event).__name__, event.key, jp.start.date(), day,
            )
            count += 1
        return count
