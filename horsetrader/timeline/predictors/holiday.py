from datetime import datetime

from horsetrader.core import JST, UTC, Period
from horsetrader.models.events import Anchor
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor, nearest_weekday


# The two holiday flavours among the collapsed Anchor type. Anniversaries are an
# anchor too but predict on their own cadence (see AnniversaryPredictor).
_HOLIDAY_KINDS = ("golden-week", "new-year")


def _is_holiday(event) -> bool:
    return isinstance(event, Anchor) and event.kind in _HOLIDAY_KINDS


@matikanefukukitaru
class HolidayPredictor(Predictor):
    """Predict EN release dates for Golden Week and New Year anchors."""

    def predict(self, timeline: Timeline) -> int:
        valid_weekdays = {
            d
            for d, n in self.weekday(
                lambda e: isinstance(e, Anchor) and e.kind == "golden-week", UTC
            ).items()
            if n > 0
        } | {
            d
            for d, n in self.weekday(
                lambda e: isinstance(e, Anchor) and e.kind == "new-year", UTC
            ).items()
            if n > 0
        }
        if not valid_weekdays:
            return 0

        count = 0
        for event in self._timeline:
            if _is_holiday(event) and not any(p.tzinfo == UTC for p in event.periods):
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
