from datetime import date, datetime

from horsetrader.core import JST, UTC, Period
from horsetrader.models.events import Anniversary, Banner, GoldenWeek, NewYear, Scenario
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor

_ANCHOR_TYPES = (Anniversary, GoldenWeek, NewYear, Scenario)


@matikanefukukitaru
class BannerPredictor(Predictor):
    """Predict EN banner release dates.

    Pass 1 (high confidence): if a JP banner co-released with a scenario,
    anniversary, or holiday, snap it to that event's EN date (confirmed or predicted).
    """

    def predict(self, timeline: Timeline) -> int:
        anchor_en_by_jp_date: dict[date, Period] = {}
        for event in self._timeline:
            if isinstance(event, _ANCHOR_TYPES):
                jp = next((p for p in event.periods if p.tzinfo == JST), None)
                en = next((p for p in event.periods if p.tzinfo == UTC), None)
                if jp and en:
                    anchor_en_by_jp_date[jp.start.date()] = en

        count = 0
        for event in self._timeline:
            if isinstance(event, Banner) and not any(p.tzinfo == UTC for p in event.periods):
                jp = next((p for p in event.periods if p.tzinfo == JST), None)
                if jp is not None:
                    anchor = anchor_en_by_jp_date.get(jp.start.date())
                    if anchor is not None:
                        event.periods.append(Period(
                            start=datetime(anchor.start.year, anchor.start.month, anchor.start.day, 22, tzinfo=UTC),
                            span=jp.span,
                            predicted=True,
                        ))
                        count += 1

        return count
