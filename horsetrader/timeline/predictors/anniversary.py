from datetime import datetime, timedelta

from horsetrader.core import JST, UTC, Period
from horsetrader.models.events import Anniversary, AnniversaryMission
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor, nearest_weekday


def _is_anniversary(event) -> bool:
    return isinstance(event, Anniversary)


@matikanefukukitaru
class AnniversaryPredictor(Predictor):
    """Predict EN anniversary release dates from the JST timeline.

    A confirmed celebration part wins over the slope: monthly schedules announce
    Part 1 (the countdown) before the anniversary date, so the date is that
    part's EN start shifted by its JP day-offset from the anniversary — the
    exact inverse of `AnniversaryMissionPredictor`. Still a prediction.
    """

    def predict(self, timeline: Timeline) -> int:
        count = self._predict_from_confirmed_parts()

        confirmed = [
            (jp.start, en.start)
            for event in self._timeline
            if _is_anniversary(event)
            for jp in [next((p for p in event.periods if p.tzinfo == JST and not p.predicted), None)]
            for en in [next((p for p in event.periods if p.tzinfo == UTC and not p.predicted), None)]
            if jp and en
        ]
        if not confirmed:
            return count

        weekday_counts: dict[int, int] = {i: 0 for i in range(7)}
        for _, en_start in confirmed:
            weekday_counts[en_start.weekday()] += 1
        valid_weekdays = {d for d, n in weekday_counts.items() if n > 0}

        try:
            slope = self._timeline.acceleration(JST, UTC)
        except ValueError:
            return count

        jp_anchor = min(p[0] for p in confirmed)
        utc_anchor = min(p[1] for p in confirmed)

        for event in self._timeline:
            if _is_anniversary(event) and not any(p.tzinfo == UTC for p in event.periods):
                jp = next((p for p in event.periods if p.tzinfo == JST), None)
                if jp is not None:
                    jp_elapsed = (jp.start - jp_anchor).total_seconds() / 86400
                    rough = utc_anchor + timedelta(days=slope * jp_elapsed)
                    snapped = nearest_weekday(rough, valid_weekdays)
                    event.periods.append(Period(
                        start=datetime(snapped.year, snapped.month, snapped.day, 22, tzinfo=UTC),
                        predicted=True,
                    ))
                    count += 1

        return count

    def _predict_from_confirmed_parts(self) -> int:
        anniversaries = {
            str(event.key): event
            for event in self._timeline
            if _is_anniversary(event) and not any(p.tzinfo == UTC for p in event.periods)
        }
        count = 0
        for event in self._timeline:
            if not isinstance(event, AnniversaryMission):
                continue
            anniversary = anniversaries.get(str(event.anniversary))
            if anniversary is None or any(p.tzinfo == UTC for p in anniversary.periods):
                continue
            part_jp = next((p for p in event.periods if p.tzinfo == JST), None)
            part_en = next(
                (p for p in event.periods if p.tzinfo == UTC and not p.predicted), None
            )
            anni_jp = next((p for p in anniversary.periods if p.tzinfo == JST), None)
            if part_jp is None or part_en is None or anni_jp is None:
                continue
            offset = part_jp.start.date() - anni_jp.start.date()
            anniversary.periods.append(
                Period(start=part_en.start - offset, predicted=True)
            )
            count += 1
        return count
