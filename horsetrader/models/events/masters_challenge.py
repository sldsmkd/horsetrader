from dataclasses import dataclass

from horsetrader.output._records import MastersChallengeRecord
from horsetrader.semantics import daitaku

from .wikiru_event import WikiruEvent, WikiruEvents


@daitaku
@dataclass
class MastersChallenge(WikiruEvent):
    """A Masters Challenge occurrence — recurring, a long ~3-month *season*
    window (vs the ~1-week competitions). Rushable (confirmed).

    **Rewards HELD (#15):** this is a PvP event with *graded* rewards — payout
    scales with the player's rank, so a flat full-clear set would overstate it
    (the Champions Meeting problem). Left unstamped pending a decision on how to
    model graded/performance-dependent payouts.
    """

    _RECORD = MastersChallengeRecord


@daitaku
class MastersChallenges(WikiruEvents[MastersChallenge]):
    _HEADING = "マスターズチャレンジ"
    _KEY_PREFIX = "masterschallenge"
    # Provisional EN label until an EN occurrence ships.
    _EN_NAME = "Masters Challenge"
    _MODEL = MastersChallenge

    def search(self, query) -> list[MastersChallenge]:
        return super().search(query)

    def _fetch_primary(self) -> list[MastersChallenge]:
        # Rewards HELD (#15): PvP graded payout — see class docstring. Raw data
        # for when we return: 900 carats, 1 rainbow + 1 gold shard (full clear).
        return self._build_events()
