import math
from datetime import datetime, timedelta

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger
from horsetrader.models.events import LegendRace
from horsetrader.semantics import matikanefukukitaru

from ..datemapper import DateMapper
from ..timeline import Timeline
from .base import Predictor, snap_to_strong_launch, strong_launches

logger = Logger.get(__name__)


@matikanefukukitaru
class LegendRacePredictor(Predictor):
    """Predict EN Legend Race windows from a Legend-Race-only DateMapper.

    Legend Races are a steady ~monthly drumbeat with confirmed EN windows curated
    in `legend_races.yaml`. The generic fallthrough would interpolate them off a
    cross-type slope pulled by every other event; a type-specific mapper —
    anchored on the Legend Race JP→EN pairs alone — tracks their own cadence
    instead. Maps each unplaced race's JP **start** day; the per-leg ~3-day
    cadence is rebuilt from that start at bake time (`LegendRace._baked_legs`).

    The EN span is read from *that race's own* JP window (snapped up to whole
    days), not a cross-race average: a race runs one ~3-day leg per trainee, so
    its length is set by its leg count. JP cut from 3–4 legs to 2 from mid-2022
    (`legendrace-013` on), but every EN-confirmed pair predates the break, so a
    mean would freeze the old ~10d era onto the 2-leg (6d) races. The confirmed
    pairs show EN span == ceil(JP span) exactly (8d16:59→9d, 11d16:59→12d), so a
    2-leg 5d16:59 JP window yields the correct 6d EN window.

    Cadence/holiday watch: before `legendrace-014` was confirmed, tail
    extrapolation mapped its 2022-09-23 JP start to 2026-08-09 UTC; Cygames
    announced 2026-08-13 UTC, four days later. Mountain Day fell between the
    two dates, but the all-event JST→UTC correlation also shows recent EN dates
    running later than its full-history line. Treat this primarily as possible
    global cadence drift, with holiday adjacency only a confounder; do not add
    Legend-specific holiday snapping from one occurrence. Frozen figures and
    source links live in `docs/references/predictions/2026-08.md`.
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

        mapper = DateMapper(JST, UTC)
        for jp, en in confirmed:
            mapper.add(jp.start, en.start)
        launches = strong_launches(self._timeline)

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
            day = snap_to_strong_launch(jp.start.date(), day, launches)
            # EN events drop at 22:00 UTC, the canonical Global content instant.
            start = datetime(day.year, day.month, day.day, 22, tzinfo=UTC)
            # Length follows this race's own leg count: its JP window snapped up
            # to whole days (confirmed EN span == ceil(JP span)).
            span = timedelta(days=math.ceil((jp.end - jp.start) / timedelta(days=1)))
            event.periods.append(Period(start=start, span=span, predicted=True))
            count += 1
        return count
