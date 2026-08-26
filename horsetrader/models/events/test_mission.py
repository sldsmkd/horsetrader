from datetime import datetime, timedelta, timezone

from horsetrader.core import Period, Periods, StableKey

from .mission import Mission


def test_limited_mission_bakes_as_rushable():
    period = Period(
        datetime(2026, 8, 18, 22, tzinfo=timezone.utc),
        timedelta(days=12),
    )
    mission = Mission(
        key=StableKey("mission-00196"),
        periods=Periods([period]),
    )

    assert mission.rushable is True
    assert mission.bake(period).rushable is True
