from collections.abc import Callable
from datetime import datetime, timedelta, tzinfo

from horsetrader.models.events import Event

from ..timeline import Timeline

# Either a concrete Event subclass (matched by isinstance) or a predicate over
# events. Some types carry several flavours on one class (e.g. `Holiday` holds
# both New Year and Golden Week, told apart by `kind`), so those are selected by
# a predicate rather than the runtime type.
Selector = type[Event] | Callable[[Event], bool]


def _selects(selector: Selector, event: Event) -> bool:
    if isinstance(selector, type):
        return isinstance(event, selector)
    return selector(event)


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

    def weekday(self, selector: Selector, tz: tzinfo) -> dict[int, int]:
        """Weekday histogram (0=Mon … 6=Sun) for events matching selector in tz."""
        counts: dict[int, int] = {i: 0 for i in range(7)}
        for event in self._timeline:
            if not _selects(selector, event):
                continue
            period = next((p for p in event.periods if p.tzinfo == tz), None)
            if period is None:
                continue
            counts[period.start.weekday()] += 1
        return counts

    def monthday(self, selector: Selector, tz: tzinfo) -> dict[int, int]:
        """Day-of-month histogram (1–31) for events matching selector in tz."""
        counts: dict[int, int] = {i: 0 for i in range(1, 32)}
        for event in self._timeline:
            if not _selects(selector, event):
                continue
            period = next((p for p in event.periods if p.tzinfo == tz), None)
            if period is None:
                continue
            counts[period.start.day] += 1
        return counts
