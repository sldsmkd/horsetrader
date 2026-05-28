from datetime import datetime, timedelta, tzinfo

from horsetrader.models.events import Event

from ..timeline import Timeline


def nearest_weekday(dt: datetime, valid_weekdays: set[int]) -> datetime:
    """Return the date nearest to dt whose weekday is in valid_weekdays."""
    for offset in range(0, 4):
        for delta in (offset, -offset):
            candidate = dt + timedelta(days=delta)
            if candidate.weekday() in valid_weekdays:
                return candidate
    return dt


class Predictor:
    """Base class for timeline predictors. Just some helpers for analysis for now"""

    def __init__(self, timeline: Timeline):
        self._timeline = timeline

    def weekday(self, event_class: type[Event], tz: tzinfo) -> dict[int, int]:
        """Weekday histogram (0=Mon … 6=Sun) for events of event_class in tz."""
        counts: dict[int, int] = {i: 0 for i in range(7)}
        for event in self._timeline:
            if not isinstance(event, event_class):
                continue
            period = next((p for p in event.periods if p.tzinfo == tz), None)
            if period is None:
                continue
            counts[period.start.weekday()] += 1
        return counts

    def monthday(self, event_class: type[Event], tz: tzinfo) -> dict[int, int]:
        """Day-of-month histogram (1–31) for events of event_class in tz."""
        counts: dict[int, int] = {i: 0 for i in range(1, 32)}
        for event in self._timeline:
            if not isinstance(event, event_class):
                continue
            period = next((p for p in event.periods if p.tzinfo == tz), None)
            if period is None:
                continue
            counts[period.start.day] += 1
        return counts
