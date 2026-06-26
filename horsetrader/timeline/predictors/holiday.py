from datetime import datetime

from horsetrader.core import JST, UTC, Period
from horsetrader.models.events import Holiday
from horsetrader.semantics import matikanefukukitaru

from ..timeline import Timeline
from .base import Predictor, nearest_weekday

_COUNTDOWN_SUFFIX = "-countdown"


def _is_golden_week(event) -> bool:
    return isinstance(event, Holiday) and event.kind == "golden-week" and not event.is_countdown


def _is_new_year_main(event) -> bool:
    return isinstance(event, Holiday) and event.kind == "new-year" and not event.is_countdown


def _is_main(event) -> bool:
    """A main holiday launch we place on the seasonal weekday cadence (Golden
    Week or New Year — the countdown lead-ins derive off their parent instead).

    Marketing tie-ins are intentionally excluded for now. They have confirmed EN
    overlays once observed, but no proven repeat cadence to extrapolate.
    """
    return _is_golden_week(event) or _is_new_year_main(event)


@matikanefukukitaru
class HolidayPredictor(Predictor):
    """Predict EN release dates for Golden Week and New Year launches.

    The main launches snap to the seasonal weekday cadence (each kind votes its
    own confirmed-EN weekdays). New Year's countdown lead-ins don't predict
    independently — they end exactly at their main's start, so their EN window is
    *derived* from the main's EN once it's placed."""

    def predict(self, timeline: Timeline) -> int:
        valid_weekdays = {
            d for d, n in self.weekday(_is_golden_week, UTC).items() if n > 0
        } | {
            d for d, n in self.weekday(_is_new_year_main, UTC).items() if n > 0
        }

        count = 0
        if valid_weekdays:
            for event in self._timeline:
                if _is_main(event) and not any(p.tzinfo == UTC for p in event.periods):
                    jp = next((p for p in event.periods if p.tzinfo == JST), None)
                    if jp is None:
                        continue
                    try:
                        rough = self._timeline.predict(jp.start, UTC)
                    except ValueError:
                        break
                    snapped = nearest_weekday(rough, valid_weekdays)
                    # Carry the JP window onto the predicted EN period — these are
                    # real spans, not the old span-0 anchor points.
                    event.periods.append(Period(
                        start=datetime(snapped.year, snapped.month, snapped.day, 22, tzinfo=UTC),
                        span=jp.span,
                        predicted=True,
                    ))
                    count += 1

        count += self._derive_countdowns()
        return count

    def _derive_countdowns(self) -> int:
        """Place each countdown's EN window ending at its main's EN start.

        The countdown's JP span is fixed (countdown-start → main-start), so once
        the main carries a UTC date the countdown's EN is just `main_en − span`.
        """
        main_en = {
            str(e.key): next((p for p in e.periods if p.tzinfo == UTC), None)
            for e in self._timeline
            if _is_main(e)
        }
        count = 0
        for event in self._timeline:
            if not (isinstance(event, Holiday) and event.is_countdown):
                continue
            if any(p.tzinfo == UTC for p in event.periods):
                continue
            parent = main_en.get(str(event.key).removesuffix(_COUNTDOWN_SUFFIX))
            jp = next((p for p in event.periods if p.tzinfo == JST), None)
            if parent is None or jp is None:
                continue
            event.periods.append(
                Period(start=parent.start - jp.span, span=jp.span, predicted=True)
            )
            count += 1
        return count
