from datetime import datetime, timedelta

from horsetrader.core import JST, UTC, Japlish, Period, Periods, StableKey
from horsetrader.models.events import Anniversary, AnniversaryMission

from .anniversary import AnniversaryPredictor


def test_confirmed_part_one_places_anniversary_by_its_jp_offset():
    # Mirrors 2.0: JP countdown 2023-02-14, anniversary 2023-02-24; Global
    # announced Part 1 for 2026-11-21 22:00 but not the anniversary date.
    anniversary = Anniversary(
        key=StableKey("anniversary-2_0"),
        periods=Periods([Period(datetime(2023, 2, 24, 12, tzinfo=JST))]),
        paid_ssr_selectors=2,
        paid_trainee_selectors=2,
    )
    part_one = AnniversaryMission(
        key=StableKey("mission-00301"),
        periods=Periods([
            Period(datetime(2023, 2, 14, 12, tzinfo=JST), span=timedelta(days=44)),
            Period(datetime(2026, 11, 21, 22, tzinfo=UTC)),
        ]),
        title=Japlish("2nd Anniversary記念ミッション第1弾", encoding="jp"),
        anniversary=StableKey("anniversary-2_0"),
        part=1,
    )
    timeline = [anniversary, part_one]

    assert AnniversaryPredictor(timeline).predict(timeline) == 1

    en = next(p for p in anniversary.periods if p.tzinfo == UTC)
    assert en.start == datetime(2026, 12, 1, 22, tzinfo=UTC)
    assert en.predicted
