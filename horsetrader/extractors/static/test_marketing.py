from datetime import datetime, timedelta

from horsetrader.core import JST, UTC

from .marketing import load


def test_umayuru_carries_exact_global_episode_drop_schedule():
    record = next(r for r in load() if r["key"] == "holiday-marketing-umayuru")

    assert record["period"].start == datetime(2022, 10, 17, 12, tzinfo=JST)
    assert record["period"].span == timedelta(days=167, hours=17)
    assert record["en"]["period"].start == datetime(
        2026, 8, 26, 22, tzinfo=UTC
    )
    assert record["en"]["period"].span == timedelta(days=125, hours=17)
    assert record["en"]["period"].end == datetime(2026, 12, 30, 15, tzinfo=UTC)

    sequence = record["rewards"]["sequence"]["sequence"]
    assert len(sequence) == 120
    assert [i for i, amount in enumerate(sequence) if amount is not None] == [
        0, 4, 11, 15, 22, 28, 32, 39, 43, 50, 54,
        61, 71, 74, 81, 84, 91, 95, 102, 109, 112, 119,
    ]
    assert sum(amount or 0 for amount in sequence) == 3_300
    assert record["contents"] == ["support-30145-tanino-gimlet"]
    assert record["banner_url"] == "umayaru-login.png"


def test_tokyo_mega_illumi_carries_confirmed_global_window_and_news_art():
    record = next(
        r for r in load() if r["key"] == "holiday-marketing-tokyo-mega-illumi"
    )

    assert record["name"] == "Sparkly Magic Skyway!"
    assert record["period"].start == datetime(2022, 12, 12, 12, tzinfo=JST)
    assert record["period"].span == timedelta(days=17)
    assert record["en"]["period"].start == datetime(
        2026, 10, 8, 15, tzinfo=UTC
    )
    assert record["en"]["period"].end == datetime(
        2026, 10, 24, 14, 59, tzinfo=UTC
    )
    sequence = record["rewards"]["sequence"]["sequence"]
    assert [i for i, amount in enumerate(sequence) if amount is not None] == [0, 12]
    assert sum(amount or 0 for amount in sequence) == 650
    assert record["banner_url"].endswith(
        "/announce/1109/Thumbnail/banner_31100001.png?c=20221219164903"
    )
    assert record["banner_version"] == 2
