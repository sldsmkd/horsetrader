"""Chrome-rendered Gametora datetimes are UTC wall-clocks (Chrome is pinned to
`CHROME_TIMEZONE`), never JST/UTC by page locale. Fixture strings are real
renders from a UTC-pinned browser."""

from datetime import datetime, timedelta

import pytest

from horsetrader.core import JST, UTC

from .champions_meetings import GametoraChampionsMeetings
from .dates import rendered_instant
from .legend_races import GametoraLegendRaces
from .missions import GametoraMissions
from .story import GametoraStory


def test_rendered_instant_reads_pinned_wall_clock():
    assert rendered_instant(datetime(2026, 11, 8, 20, 0)) == datetime(2026, 11, 8, 20, 0, tzinfo=UTC)


def test_rendered_instant_rejects_aware_input():
    with pytest.raises(ValueError, match="naive"):
        rendered_instant(datetime(2026, 11, 8, 20, 0, tzinfo=JST))


def test_jp_mission_window_crosses_into_next_jst_day():
    period = GametoraMissions._parse_jp_period("開始日時 2026年11月8日 20:00 終了日時 2026年11月15日 19:59")
    assert period.start == datetime(2026, 11, 9, 5, 0, tzinfo=JST)
    assert period.start.utcoffset() == timedelta(hours=9)
    assert period.start + period.span == datetime(2026, 11, 16, 4, 59, tzinfo=JST)


def test_en_mission_window_is_global_reset():
    period = GametoraMissions._parse_en_period("Start: 5 Nov 2026, 15:00 End: 12 Nov 2026, 14:59")
    assert period.start == datetime(2026, 11, 5, 15, 0, tzinfo=UTC)
    assert period.start.utcoffset() == timedelta(0)


def test_legend_race_window_is_jp_noon_drop():
    period = GametoraLegendRaces._parse_period("2026年11月6日 3:00 – 2026年11月11日 19:59")
    assert period.start == datetime(2026, 11, 6, 12, 0, tzinfo=JST)


def test_story_window_is_jp_noon_drop():
    period = GametoraStory._parse_period("2022年3月29日 3:00 から 2022年4月6日 2:59")
    assert period.start == datetime(2022, 3, 29, 12, 0, tzinfo=JST)


def test_cm_legacy_explicit_time_is_rendered():
    period = GametoraChampionsMeetings._parse_jp_period("2021年5月14日 3:00 – 2021年5月20日 2:59")
    assert period.start == datetime(2021, 5, 14, 12, 0, tzinfo=JST)


def test_cm_date_only_row_stamps_jp_boundary():
    period = GametoraChampionsMeetings._parse_jp_period("日本版 2026年10月20日 2026年10月26日")
    assert period.start == datetime(2026, 10, 20, 12, 0, tzinfo=JST)
