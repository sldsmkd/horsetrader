from datetime import timezone

from horsetrader.semantics import matikanefukukitaru

from .predictors import (
    AnchorPredictor,
    AnniversaryMissionPredictor,
    AnniversaryPredictor,
    BannerPredictor,
    ChampionsMeetingPredictor,
    FallthroughPredictor,
    HolidayPredictor,
    LegendRacePredictor,
    ScenarioPredictor,
    StoryPredictor,
    shape_anniversary_mission_windows,
)
from .timeline import Timeline


@matikanefukukitaru
class Predict:
    """Extend a JST Timeline with predicted UTC periods for unscheduled EN events.

    Runs an ordered chain of predictors — most authoritative first (external marketing
    anchors, then internal dev milestones, then fill-in). Each predictor mutates events
    in place (appends a predicted UTC Period to events missing one) and returns the count
    of new predictions made.

    Returns a UTC Timeline built from all events carrying a UTC period (confirmed and
    predicted).
    """

    def __init__(self) -> None:
        self._stats: dict[str, int] = {}

    def stats(self) -> dict[str, int]:
        return self._stats

    def predict(self, timeline: Timeline) -> Timeline:
        for predictor in (
            AnniversaryPredictor(timeline),
            # Celebration missions ARE part of the anniversary — pinned to it by
            # key — so they place immediately behind it (it must land first; Mati
            # keys off its EN date), ahead of the general cadence fills.
            AnniversaryMissionPredictor(timeline),
            HolidayPredictor(timeline),
            ScenarioPredictor(timeline),
            StoryPredictor(timeline),
            BannerPredictor(timeline),
        ):
            key = type(predictor).__name__.lower().removesuffix("predictor")
            self._stats[key] = predictor.predict(timeline)

        # CM windows are final-anchored and longer than their JP scrape, so they
        # need a dedicated pass before the generic fallthrough would mis-map them
        # off the opening day with the wrong span. League of Heroes shares this
        # pass (it replaces a CM on the same cadence) — but the two are distinct
        # events, so their placements are reported apart.
        meetings = ChampionsMeetingPredictor(timeline)
        meetings.predict(timeline)
        self._stats["championsmeeting"] = meetings.placed["ChampionsMeeting"]
        self._stats["leagueofheroes"] = meetings.placed["LeagueOfHeroes"]

        for predictor in (
            # Steady ~monthly cadence with curated EN anchors — a type-specific
            # mapper tracks it better than the cross-type fallthrough.
            LegendRacePredictor(timeline),
            # Anchored campaigns derive their UTC from the anchor dates the
            # predictors above have just stamped (and chain off one another).
            AnchorPredictor(timeline),
        ):
            key = type(predictor).__name__.lower().removesuffix("predictor")
            self._stats[key] = predictor.predict(timeline)

        # Dead last: the generic catch-all, mapping anything still missing a UTC
        # period through a DateMapper built from everything scheduled above. Its
        # placements split into `uncategorised` (accepted types riding the
        # catch-all by design) and `fallthrough` (genuine surprises — a type a
        # dedicated pass should have placed), reported apart so `fallthrough`
        # stays an actionable signal.
        fallthrough = FallthroughPredictor(timeline)
        fallthrough.predict(timeline)
        self._stats["fallthrough"] = fallthrough.surprises
        self._stats["uncategorised"] = fallthrough.uncategorised

        # Not a placement: reshape the anniversary missions' EN spans to their
        # curated login-bonus window (`en.duration`), over both predicted and
        # confirmed periods. Runs last so every EN period it touches already exists.
        self._stats["anniversarymissionwindow"] = shape_anniversary_mission_windows(
            timeline
        )

        utc = Timeline(
            timezone.utc,
            [e for e in timeline if any(p.tzinfo == timezone.utc for p in e.periods)],
        )
        self._stats["unpredicted"] = len(timeline) - len(utc)
        return utc
