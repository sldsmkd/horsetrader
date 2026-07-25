from horsetrader.core import StableKey
from horsetrader.models.rewards import rewards_to_baked

from .anniversary_mission import _celebration_rewards


def test_part_two_login_keeps_card_days_carats_and_present_separate():
    rewards = _celebration_rewards(StableKey("mission-00218"))

    assert rewards_to_baked(rewards) == {
        "free_carats": 3000,
        "sequence": {
            "type": "free_carats",
            "sequence": [300] * 10,
        },
    }
