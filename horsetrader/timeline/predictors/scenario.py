from datetime import date, datetime, timedelta

from horsetrader.core import JST, UTC, Period
from horsetrader.models.events import Anniversary, Scenario
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor, nearest_weekday


@matikanefukukitaru
class ScenarioPredictor(Predictor):
    """Predict EN scenario release dates from the JST timeline and static data."""

    def predict(self, timeline: Timeline) -> int:
        # Anniversary anchors: scenarios that share a JP drop date with an anniversary
        # snap their EN date to the anniversary EN date (confirmed or predicted).
        anni_en_by_jp_date: dict[date, Period] = {}
        for event in self._timeline:
            if isinstance(event, Anniversary):
                jp = next((p for p in event.periods if p.tzinfo == JST), None)
                en = next((p for p in event.periods if p.tzinfo == UTC), None)
                if jp and en:
                    anni_en_by_jp_date[jp.start.date()] = en

        # Weekday signal — monthday discounted under compressed acceleration
        valid_weekdays = {d for d, n in self.weekday(Scenario, UTC).items() if n > 0}
        if not valid_weekdays:
            return 0

        # Pass 1: place each unscheduled scenario via global JP→UTC acceleration
        try:
            slope = self._timeline.acceleration(JST, UTC)
        except ValueError:
            return 0

        confirmed = [
            (jp.start, en.start)
            for event in self._timeline
            for jp in [next((p for p in event.periods if p.tzinfo == JST and not p.predicted), None)]
            for en in [next((p for p in event.periods if p.tzinfo == UTC and not p.predicted), None)]
            if jp and en
        ]
        jp_anchor = min(p[0] for p in confirmed)
        utc_anchor = min(p[1] for p in confirmed)

        count = 0
        for event in self._timeline:
            if isinstance(event, Scenario) and not any(p.tzinfo == UTC for p in event.periods):
                jp = next((p for p in event.periods if p.tzinfo == JST), None)
                if jp is not None:
                    anni_anchor = anni_en_by_jp_date.get(jp.start.date())
                    if anni_anchor is not None:
                        event.periods.append(Period(
                            start=datetime(anni_anchor.start.year, anni_anchor.start.month,
                                           anni_anchor.start.day, 22, tzinfo=UTC),
                            predicted=True,
                        ))
                    else:
                        jp_elapsed = (jp.start - jp_anchor).total_seconds() / 86400
                        rough = utc_anchor + timedelta(days=slope * jp_elapsed)
                        # Pass 2: jiggle to the nearest weekday with historical EN release data
                        snapped = nearest_weekday(rough, valid_weekdays)
                        event.periods.append(Period(
                            start=datetime(snapped.year, snapped.month, snapped.day, 22, tzinfo=UTC),
                            predicted=True,
                        ))
                    count += 1

        return count
