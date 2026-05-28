from datetime import datetime, timedelta

from horsetrader.core import JST, UTC, Period
from horsetrader.models.events import GoldenWeek, NewYear
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor, nearest_weekday


_HOLIDAY_TYPES = (GoldenWeek, NewYear)


@matikanefukukitaru
class HolidayPredictor(Predictor):
    """Predict EN release dates for GoldenWeek and NewYear events."""

    def predict(self, timeline: Timeline) -> int:
        valid_weekdays = {
            d for d, n in self.weekday(GoldenWeek, UTC).items() if n > 0
        } | {
            d for d, n in self.weekday(NewYear, UTC).items() if n > 0
        }
        if not valid_weekdays:
            return 0

        try:
            slope = self._timeline.acceleration(JST, UTC)
        except ValueError:
            return 0

        confirmed = [
            (jp.start, en.start)
            for event in self._timeline
            if isinstance(event, _HOLIDAY_TYPES)
            for jp in [next((p for p in event.periods if p.tzinfo == JST and not p.predicted), None)]
            for en in [next((p for p in event.periods if p.tzinfo == UTC and not p.predicted), None)]
            if jp and en
        ]
        if not confirmed:
            return 0

        jp_anchor = min(p[0] for p in confirmed)
        utc_anchor = min(p[1] for p in confirmed)

        count = 0
        for event in self._timeline:
            if isinstance(event, _HOLIDAY_TYPES) and not any(p.tzinfo == UTC for p in event.periods):
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
