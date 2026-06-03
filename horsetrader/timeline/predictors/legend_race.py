from datetime import datetime, timedelta
from statistics import mean

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger
from horsetrader.models.events import LegendRace
from horsetrader.semantics import matikanefukukitaru

from ..datemapper import DateMapper
from ..timeline import Timeline
from .base import Predictor

logger = Logger.get(__name__)

_DEFAULT_EN_SPAN = timedelta(days=10)


@matikanefukukitaru
class LegendRacePredictor(Predictor):
    """Predict EN Legend Race windows from a Legend-Race-only DateMapper.

    Legend Races are a steady ~monthly drumbeat with confirmed EN windows curated
    in `legend_races.yaml`. The generic fallthrough would interpolate them off a
    cross-type slope pulled by every other event; a type-specific mapper —
    anchored on the Legend Race JP→EN pairs alone — tracks their own cadence
    instead. Maps each unplaced race's JP **start** day; the per-leg ~3-day
    cadence is rebuilt from that start at bake time (`LegendRace._baked_legs`), so
    only the start anchor matters here. The span is the mean confirmed EN window
    (legs tile it), defaulting to ~10d until enough are confirmed.
    """

    def predict(self, timeline: Timeline) -> int:
        confirmed: list[tuple[Period, Period]] = []
        for event in self._timeline:
            if not isinstance(event, LegendRace):
                continue
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            en = next((p for p in event.periods if p.tzinfo == UTC), None)
            if jp and en:
                confirmed.append((jp, en))

        # Need at least two confirmed pairs for the DateMapper to interpolate the
        # JST→UTC warp; with fewer, leave them for the generic fallthrough.
        if len(confirmed) < 2:
            return 0

        span = timedelta(
            days=round(mean((en.end - en.start).days for _, en in confirmed))
        )
        mapper = DateMapper(JST, UTC)
        for jp, en in confirmed:
            mapper.add(jp.start, en.start)

        count = 0
        for event in self._timeline:
            if not isinstance(event, LegendRace):
                continue
            if any(p.tzinfo == UTC for p in event.periods):
                continue
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            if jp is None:
                continue
            day = mapper.predict(jp.start, UTC)
            # EN events drop at 22:00 UTC, the canonical Global content instant.
            start = datetime(day.year, day.month, day.day, 22, tzinfo=UTC)
            event.periods.append(Period(start=start, span=span, predicted=True))
            count += 1
        return count
