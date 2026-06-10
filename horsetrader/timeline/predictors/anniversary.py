from datetime import datetime, timedelta

from horsetrader.core import JST, UTC, Period
from horsetrader.models.events import Anniversary
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor, nearest_weekday


def _is_anniversary(event) -> bool:
    return isinstance(event, Anniversary)


@matikanefukukitaru
class AnniversaryPredictor(Predictor):
    """Predict EN anniversary release dates from the JST timeline."""

    def predict(self, timeline: Timeline) -> int:
        confirmed = [
            (jp.start, en.start)
            for event in self._timeline
            if _is_anniversary(event)
            for jp in [next((p for p in event.periods if p.tzinfo == JST and not p.predicted), None)]
            for en in [next((p for p in event.periods if p.tzinfo == UTC and not p.predicted), None)]
            if jp and en
        ]
        if not confirmed:
            return 0

        weekday_counts: dict[int, int] = {i: 0 for i in range(7)}
        for _, en_start in confirmed:
            weekday_counts[en_start.weekday()] += 1
        valid_weekdays = {d for d, n in weekday_counts.items() if n > 0}

        try:
            slope = self._timeline.acceleration(JST, UTC)
        except ValueError:
            return 0

        jp_anchor = min(p[0] for p in confirmed)
        utc_anchor = min(p[1] for p in confirmed)

        count = 0
        for event in self._timeline:
            if _is_anniversary(event) and not any(p.tzinfo == UTC for p in event.periods):
                jp = next((p for p in event.periods if p.tzinfo == JST), None)
                if jp is not None:
                    jp_elapsed = (jp.start - jp_anchor).total_seconds() / 86400
                    rough = utc_anchor + timedelta(days=slope * jp_elapsed)
                    snapped = nearest_weekday(rough, valid_weekdays)
                    event.periods.append(Period(
                        start=datetime(snapped.year, snapped.month, snapped.day, 22, tzinfo=UTC),
                        predicted=True,
                    ))
                    count += 1

        return count
