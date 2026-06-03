from dataclasses import dataclass

from horsetrader.output._records import StrongestTeamRecord
from horsetrader.semantics import daitaku

from .wikiru_event import WikiruEvent, WikiruEvents


@daitaku
@dataclass
class StrongestTeam(WikiruEvent):
    """An Aim! Strongest Team occurrence — recurring competition (~1-week window), rushable.

    Distinct from League of Heroes (#9) — confirmed not the same event.

    **Rewards HELD (#13):** PvP event with *graded* rewards (payout scales with
    rank), so a flat full-clear set would overstate it (the Champions Meeting
    problem). Left unstamped pending a decision on modelling graded payouts.
    """

    _RECORD = StrongestTeamRecord


@daitaku
class StrongestTeams(WikiruEvents[StrongestTeam]):
    _HEADING = "目指せ！最強チーム"
    _KEY_PREFIX = "strongestteam"
    # Provisional EN label until an EN occurrence ships.
    _EN_NAME = "Aim! Strongest Team"
    _MODEL = StrongestTeam

    def search(self, query) -> list[StrongestTeam]:
        return super().search(query)

    def _fetch_primary(self) -> list[StrongestTeam]:
        # Rewards HELD (#13): PvP graded payout — see class docstring. Raw data
        # for when we return: 1300 carats (first occurrence) → 1500 thereafter,
        # 2 rainbow + 2 gold shards, 2 trainee + 2 support tickets (full clear).
        return self._build_events()
