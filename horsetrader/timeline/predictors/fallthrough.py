from datetime import datetime

from horsetrader.core import JST, UTC, Period
from horsetrader.info import Logger
from horsetrader.models.events import (
    FactorStudies,
    MastersChallenge,
    Mission,
    RacingCarnival,
    SkillTest,
    Showtime,
    StrongestTeam,
)
from horsetrader.semantics import matikanefukukitaru

from ..datemapper import DateMapper
from ..timeline import Timeline
from .base import Predictor, snap_to_strong_launch, strong_launches

logger = Logger.get(__name__)

# Types whose generic interpolation is *accepted* — audited as not warranting a
# dedicated catcher: each is recurring but carries no confirmed EN anchors and no
# known EN-specific scheduling rule, so a type-specific mapper couldn't beat the
# global one (Missions additionally have no cadence at all — a campaign-tied flat
# catalogue). Their fall-through is expected, so it logs at debug. NOT here on
# purpose: League of Heroes (CM-anchored, handled by ChampionsMeetingPredictor)
# and Legend Race (its own LegendRacePredictor) — a fall-through of either would
# be a real surprise worth the warning.
_ACCEPTED_FALLTHROUGH = (
    FactorStudies,
    MastersChallenge,
    Mission,
    RacingCarnival,
    SkillTest,
    Showtime,
    StrongestTeam,
)

_STRONG_LAUNCH_SNAP = (
    FactorStudies,
    MastersChallenge,
    RacingCarnival,
    SkillTest,
    Showtime,
    StrongestTeam,
)


@matikanefukukitaru
class FallthroughPredictor(Predictor):
    """Last-resort predictor for events no dedicated pass could place.

    Runs at the very end of the chain. Builds a `DateMapper` from every event
    already carrying both a JP and a UTC period (confirmed, or predicted by an
    earlier pass), then maps the JP day of anything still missing a UTC period
    through it. Cross-type by design — the JST→UTC server warp is shared, so a
    stray story can ride banner/scenario anchors and vice versa.

    The recurring limited-event family gets one conservative correction after
    mapping: if its JP day and mapped EN day are both within ±1 day of a
    corroborated co-release cluster, snap onto that launch. This catches source
    dates recorded a day after the actual coordinated content drop without
    letting singleton events pull the catch-all around.

    Otherwise there is no weekday snap or per-type signal. The more the passes
    above schedule, the more local slopes this has to interpolate against —
    accuracy rises as the timeline fills in. Lower confidence than the dedicated
    passes; it only ever sees what they left behind.
    """

    def predict(self, timeline: Timeline) -> int:
        # Split this pass's placements: `uncategorised` = accepted types riding
        # the catch-all by design (audited as not needing a catcher); `surprises`
        # = everything else (a type a dedicated pass should have placed). Reported
        # apart so `fallthrough` in the pipeline stats stays an actionable signal.
        self.uncategorised = 0
        self.surprises = 0
        mapper = DateMapper(JST, UTC)
        launches = strong_launches(self._timeline)
        for event in self._timeline:
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            en = next((p for p in event.periods if p.tzinfo == UTC), None)
            if jp and en:
                mapper.add(jp.start, en.start)

        count = 0
        for event in self._timeline:
            if not event.predictable:
                continue
            if any(p.tzinfo == UTC for p in event.periods):
                continue
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            if jp is None:
                continue
            try:
                day = mapper.predict(jp.start, UTC)
            except ValueError:
                continue  # fewer than 2 anchors yet — nothing to interpolate from
            if isinstance(event, _STRONG_LAUNCH_SNAP):
                day = snap_to_strong_launch(jp.start.date(), day, launches)
            event.periods.append(Period(
                start=datetime(day.year, day.month, day.day, 22, tzinfo=UTC),
                span=jp.span,
                predicted=True,
            ))
            # Surfaced per-event on purpose: a line here is something no dedicated
            # pass placed. Accepted types (audited as not needing a catcher) are
            # tagged uncategorised and log at debug; anything else is a surprise
            # and stays a warning — add a mapper/predictor for it or move it into
            # `_ACCEPTED_FALLTHROUGH`, but don't let it pass silently.
            if isinstance(event, _ACCEPTED_FALLTHROUGH):
                self.uncategorised += 1
                log = logger.debug
                tag = "uncategorised"
            else:
                self.surprises += 1
                log = logger.warning
                tag = "SURPRISE"
            log(
                "%s %s (JP %s) fell through to the generic DateMapper -> EN %s [%s]",
                type(event).__name__, event.key, jp.start.date(), day, tag,
            )
            count += 1
        return count
