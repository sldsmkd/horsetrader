from bisect import bisect_left
from collections import defaultdict
from datetime import date, datetime, tzinfo

from horsetrader.semantics import matikanefukukitaru


def _ordinal(when: date | datetime) -> int:
    """Proleptic-Gregorian day number for a date or the date part of a datetime."""
    if isinstance(when, datetime):
        when = when.date()
    return when.toordinal()


@matikanefukukitaru
class DateMapper:
    """Bidirectional, piecewise-linear date map between two timezones.

    Feed it known date pairs as events get scheduled — one calendar day in
    each zone, e.g. a banner's JP drop day and its EN release day — then ask
    `predict()` for the day in either zone given the day in the other.

    Lookup is a bisect to the bracketing pairs, a linear interpolation along
    that segment, and a round to the nearest whole day. Queries outside the
    known range extrapolate off the nearest end segment's slope, so the tail
    keeps marching at the local rate rather than falling off a cliff.

    The two zones are assumed to advance monotonically together (a later JP
    day maps to a later EN day), which holds for a single server's release
    schedule. Identical pairs are deduplicated; when several days on one axis
    collapse onto the same day of the other (multiple banners sharing a drop
    day), the opposite axis is averaged for that day so every segment stays
    positive-width and the result is independent of insertion order.
    """

    def __init__(self, from_tz: tzinfo, to_tz: tzinfo) -> None:
        if from_tz == to_tz:
            raise ValueError("DateMapper needs two distinct timezones")
        self._from_tz = from_tz
        self._to_tz = to_tz
        self._pairs: set[tuple[int, int]] = set()

    def __len__(self) -> int:
        return len(self._pairs)

    def add(self, from_date: date | datetime, to_date: date | datetime) -> None:
        """Register a known pair: ``from_date`` in ``from_tz``, ``to_date`` in ``to_tz``."""
        self._pairs.add((_ordinal(from_date), _ordinal(to_date)))

    def predict(self, when: date | datetime, to: tzinfo) -> date:
        """Map ``when`` to a day in zone ``to``; the other zone is taken as the source."""
        if to == self._to_tz:
            table = self._table(source_first=True)
        elif to == self._from_tz:
            table = self._table(source_first=False)
        else:
            raise ValueError(f"{to!r} is not one of this mapper's zones")
        return date.fromordinal(_interpolate(table, _ordinal(when)))

    def _table(self, *, source_first: bool) -> list[tuple[int, float]]:
        """Sorted (source-day, mean target-day) table for the requested direction."""
        groups: dict[int, list[int]] = defaultdict(list)
        for frm, to in self._pairs:
            src, tgt = (frm, to) if source_first else (to, frm)
            groups[src].append(tgt)
        return sorted((src, sum(tgts) / len(tgts)) for src, tgts in groups.items())


def _interpolate(table: list[tuple[int, float]], q: int) -> int:
    """Piecewise-linear lookup of ``q`` against a sorted (x, y) table, rounded to int."""
    if not table:
        raise ValueError("DateMapper is empty; add pairs before predicting")
    xs = [x for x, _ in table]
    i = bisect_left(xs, q)
    if i < len(xs) and xs[i] == q:
        return round(table[i][1])  # exact anchor day
    if len(table) == 1:
        raise ValueError("DateMapper needs at least 2 distinct days to interpolate")
    # Clamp the lower bracket so i==0 (below range) and i==len (above range) both
    # fall back to the nearest end segment and extrapolate along its slope.
    lo = min(max(i - 1, 0), len(table) - 2)
    (x0, y0), (x1, y1) = table[lo], table[lo + 1]
    frac = (q - x0) / (x1 - x0)
    return round(y0 + frac * (y1 - y0))
