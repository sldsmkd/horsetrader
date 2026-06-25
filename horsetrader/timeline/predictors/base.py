from collections import defaultdict
from collections.abc import Callable
from datetime import date, datetime, timedelta, tzinfo

from horsetrader.core import JST, UTC
from horsetrader.models.events import Event

from ..timeline import Timeline

# Either a concrete Event subclass (matched by isinstance) or a predicate over
# events. Some types carry several flavours on one class (e.g. `Holiday` holds
# both New Year and Golden Week, told apart by `kind`), so those are selected by
# a predicate rather than the runtime type.
Selector = type[Event] | Callable[[Event], bool]
StrongLaunch = tuple[date, date, int]


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


def strong_launches(timeline: Timeline) -> list[StrongLaunch]:
    """Return JP→EN launch-day pairs corroborated by at least two events.

    A same-day banner pair, or a banner plus its story/scenario, is a stronger
    scheduling signal than any singleton event. Keep the supporting event count
    so a denser co-release wins deterministic ties.
    """
    counts: dict[tuple[date, date], int] = defaultdict(int)
    for event in timeline:
        jp = next((p for p in event.periods if p.tzinfo == JST), None)
        en = next((p for p in event.periods if p.tzinfo == UTC), None)
        if jp is not None and en is not None:
            counts[(jp.start.date(), en.start.date())] += 1
    return [
        (jp_day, en_day, count)
        for (jp_day, en_day), count in counts.items()
        if count >= 2
    ]


def snap_to_strong_launch(
    jp_day: date,
    mapped_en_day: date,
    launches: list[StrongLaunch],
    *,
    tolerance_days: int = 1,
) -> date:

    """Snap an off-by-one mapping onto a nearby corroborated launch cluster.

    Investigation note: the motivating Strongest Team case initially mapped to
    Friday 2026-06-26 at 22:00 UTC — already Saturday morning in Japan — while
    the actual release joined Thursday's UTC content drop. If another odd
    off-by-one appears near a weekend, check whether Global scheduling avoids a
    Friday-22:00-UTC / Saturday-JST launch before changing this into a general
    weekday rule.
    """
    candidates: list[tuple[int, int, int, date]] = []
    for launch_jp, launch_en, strength in launches:
        jp_distance = abs((launch_jp - jp_day).days)
        en_distance = abs((launch_en - mapped_en_day).days)
        if jp_distance <= tolerance_days and en_distance <= tolerance_days:
            candidates.append(
                (jp_distance + en_distance, -strength, en_distance, launch_en)
            )
    if not candidates:
        return mapped_en_day
    return min(candidates)[-1]


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
