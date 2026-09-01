from datetime import datetime, timedelta

from horsetrader.core import JST, UTC, Period, Periods, StableKey
from horsetrader.models.events import Holiday

from .holiday import HolidayPredictor


class _Timeline(list):
    def predict(self, dt: datetime, tz) -> datetime:
        assert dt == datetime(2022, 12, 12, 12, tzinfo=JST)
        assert tz == UTC
        return datetime(2026, 10, 12, tzinfo=UTC)


def _holiday(key: str, name: str, *periods: Period) -> Holiday:
    return Holiday(
        key=StableKey(key),
        name=name,
        periods=Periods(periods),
    )


def test_christmas_uses_the_holiday_predictor():
    # A confirmed holiday supplies the valid Monday launch cadence. The
    # timeline mapper supplies Christmas's rough translated date.
    confirmed = _holiday(
        "holiday-golden-week-2021",
        "Golshi Week",
        Period(datetime(2021, 4, 30, 12, tzinfo=JST), span=timedelta(days=14)),
        Period(datetime(2025, 8, 4, 22, tzinfo=UTC), span=timedelta(days=14)),
    )
    christmas = _holiday(
        "holiday-christmas-2022",
        "Holiday Celebration Part 2",
        Period(datetime(2022, 12, 12, 12, tzinfo=JST), span=timedelta(days=17)),
    )
    timeline = _Timeline([confirmed, christmas])

    assert HolidayPredictor(timeline).predict(timeline) == 1

    predicted = next(period for period in christmas.periods if period.tzinfo == UTC)
    assert predicted.start == datetime(2026, 10, 12, 22, tzinfo=UTC)
    assert predicted.span == timedelta(days=17)
    assert predicted.predicted
