from datetime import date, datetime

from horsetrader.core import JST, UTC, Period
from horsetrader.models.events import Banner, Scenario
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor


@matikanefukukitaru
class BannerPredictor(Predictor):
    """Predict EN banner release dates.

    Pass 1 (high confidence): if a JP banner co-released with a scenario, snap
    it to that scenario's EN date (confirmed or predicted by ScenarioPredictor).
    """

    def predict(self, timeline: Timeline) -> int:
        # Build JP-date → scenario UTC period index (confirmed and predicted)
        scenario_en_by_jp_date: dict[date, Period] = {}
        for event in self._timeline:
            if not isinstance(event, Scenario):
                continue
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            en = next((p for p in event.periods if p.tzinfo == UTC), None)
            if jp and en:
                scenario_en_by_jp_date[jp.start.date()] = en

        count = 0
        for event in self._timeline:
            if not isinstance(event, Banner):
                continue
            if any(p.tzinfo == UTC for p in event.periods):
                continue
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            if jp is None:
                continue
            scenario_en = scenario_en_by_jp_date.get(jp.start.date())
            if scenario_en is None:
                continue
            event.periods.append(Period(
                start=datetime(
                    scenario_en.start.year, scenario_en.start.month, scenario_en.start.day,
                    22, tzinfo=UTC,
                ),
                span=jp.span,
                predicted=True,
            ))
            count += 1

        return count
