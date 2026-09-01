from datetime import datetime, timedelta

from horsetrader.core import JST
from horsetrader.models.rewards import rewards_from_baked, rewards_to_baked

from .christmas import load


def test_christmas_2022_models_only_part_two_hard_currency():
    record = next(r for r in load() if r["key"] == "holiday-christmas-2022")

    assert record["name"] == "Holiday Celebration Part 2"
    assert record["period"].start == datetime(2022, 12, 12, 12, tzinfo=JST)
    assert record["period"].span == timedelta(days=17)
    assert record["en"] is None

    sequence = record["rewards"]["sequence"]["sequence"]
    assert len(sequence) == 13
    assert [i for i, amount in enumerate(sequence) if amount is not None] == [0, 12]
    assert sum(amount or 0 for amount in sequence) == 650
    assert rewards_to_baked(rewards_from_baked(record["rewards"])) == record["rewards"]
    assert record["banner_url"].endswith(
        "/announce/1093/Thumbnail/banner_26800001.png"
    )
