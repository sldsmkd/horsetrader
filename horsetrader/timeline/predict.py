from datetime import timezone

from horsetrader.semantics import matikanefukukitaru

from .predictors import (
    AnchorPredictor,
    AnniversaryPredictor,
    BannerPredictor,
    HolidayPredictor,
    ScenarioPredictor,
    StoryPredictor,
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
            HolidayPredictor(timeline),
            ScenarioPredictor(timeline),
            StoryPredictor(timeline),
            BannerPredictor(timeline),
            # Last: anchored campaigns derive their UTC from the anchor dates the
            # predictors above have just stamped (and chain off one another).
            AnchorPredictor(timeline),
        ):
            key = type(predictor).__name__.lower().removesuffix("predictor")
            self._stats[key] = predictor.predict(timeline)

        utc = Timeline(
            timezone.utc,
            [e for e in timeline if any(p.tzinfo == timezone.utc for p in e.periods)],
        )
        self._stats["unpredicted"] = len(timeline) - len(utc)
        return utc
