from datetime import datetime

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

        count = 0
        for event in self._timeline:
            if isinstance(event, _HOLIDAY_TYPES) and not any(p.tzinfo == UTC for p in event.periods):
                jp = next((p for p in event.periods if p.tzinfo == JST), None)
                if jp is not None:
                    try:
                        rough = self._timeline.predict(jp.start, UTC)
                    except ValueError:
                        return count
                    snapped = nearest_weekday(rough, valid_weekdays)
                    event.periods.append(Period(
                        start=datetime(snapped.year, snapped.month, snapped.day, 22, tzinfo=UTC),
                        predicted=True,
                    ))
                    count += 1

        return count
