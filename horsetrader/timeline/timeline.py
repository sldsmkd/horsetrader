from collections.abc import Iterable
from datetime import datetime, tzinfo
from typing import SupportsIndex

import numpy as np

from horsetrader.models.events.event import Event
from horsetrader.semantics import daitaku


@daitaku
class Timeline(list[Event]):
    """A tz-locked, auto-sorted list of Events.

    Each Event must have at least one Period whose tzinfo matches the Timeline's
    tz. Sorting uses the earliest matching period. Events may carry additional
    periods in other tzinfos (e.g. a JST period alongside a UTC period).
    """

    def __init__(self, tz: tzinfo, events: Iterable[Event] | None = None) -> None:
        super().__init__()
        self._tz = tz
        self._accel_cache: dict[tuple[tzinfo, tzinfo], float] = {}
        if events is not None:
            self.extend(events)

    @property
    def tz(self) -> tzinfo:
        return self._tz

    def _sort_key(self, event: Event) -> datetime:
        return min(p.start for p in event.periods if p.tzinfo == self._tz)

    def _validate(self, event: Event) -> None:
        if not any(p.tzinfo == self._tz for p in event.periods):
            raise ValueError(
                f"Event has no period in Timeline tz {self._tz!r}"
            )

    def _bust(self) -> None:
        self._accel_cache.clear()

    def append(self, event: Event) -> None:
        self._validate(event)
        super().append(event)
        self.sort(key=self._sort_key)
        self._bust()

    def extend(self, events: Iterable[Event]) -> None:
        validated = list(events)
        for event in validated:
            self._validate(event)
        super().extend(validated)
        self.sort(key=self._sort_key)
        self._bust()

    def insert(self, index: SupportsIndex, event: Event) -> None:
        self._validate(event)
        super().insert(index, event)
        self.sort(key=self._sort_key)
        self._bust()

    def acceleration(self, from_tz: tzinfo, to_tz: tzinfo, *, bust: bool = False) -> float:
        """Linear speedup of ``to_tz`` events relative to ``from_tz`` events.

        Works in elapsed days from each tz's earliest correlated anchor, then fits
        ``to_elapsed ≈ slope * from_elapsed`` through the origin via least squares.
        Requires at least 2 correlated events (events carrying periods in both tzs).
        Result is cached per ``(from_tz, to_tz)`` pair and cleared on any mutation.
        Pass ``bust=True`` to force recomputation without mutating.
        """
        key = (from_tz, to_tz)
        if not bust and key in self._accel_cache:
            return self._accel_cache[key]
        pairs: list[tuple[datetime, datetime]] = []
        for event in self:
            from_p = next((p for p in event.periods if p.tzinfo == from_tz and not p.predicted), None)
            to_p = next((p for p in event.periods if p.tzinfo == to_tz and not p.predicted), None)
            if from_p is not None and to_p is not None:
                pairs.append((from_p.start, to_p.start))
        if len(pairs) < 2:
            raise ValueError(
                f"acceleration() needs at least 2 correlated events; found {len(pairs)}"
            )
        from_anchor = min(p[0] for p in pairs)
        to_anchor = min(p[1] for p in pairs)
        x = np.array(
            [(from_dt - from_anchor).days for from_dt, _ in pairs], dtype=float
        ).reshape(-1, 1)
        y = np.array([(to_dt - to_anchor).days for _, to_dt in pairs], dtype=float)
        slope = float(np.linalg.lstsq(x, y, rcond=None)[0][0])
        self._accel_cache[key] = slope
        return slope

    def __setitem__(self, index: int | slice, event: Event | Iterable[Event]) -> None:  # type: ignore[override]
        if isinstance(index, slice):
            events = list(event)  # type: ignore[arg-type]
            for e in events:
                self._validate(e)
            super().__setitem__(index, events)
        else:
            self._validate(event)  # type: ignore[arg-type]
            super().__setitem__(index, event)  # type: ignore[arg-type]
        self.sort(key=self._sort_key)
        self._bust()
