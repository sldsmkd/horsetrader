from datetime import datetime

from horsetrader.core import UTC, StableKey
from horsetrader.models.rewards import rewards_to_baked

from .anniversary_mission import _celebration_rewards, _confirmed_en_period


def test_part_two_login_keeps_card_days_carats_and_present_separate():
    rewards = _celebration_rewards(StableKey("mission-00218"))

    assert rewards_to_baked(rewards) == {
        "free_carats": 3000,
        "sequence": {
            "type": "free_carats",
            "sequence": [300] * 10,
        },
    }


def test_part_one_carries_announced_start_without_an_anniversary_date():
    period = _confirmed_en_period(StableKey("mission-00301"))

    assert period is not None
    assert period.start == datetime(2026, 11, 21, 22, tzinfo=UTC)
    assert _confirmed_en_period(StableKey("mission-00302")) is None
