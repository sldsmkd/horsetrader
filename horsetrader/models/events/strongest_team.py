from dataclasses import dataclass

from horsetrader.output._records import StrongestTeamRecord
from horsetrader.semantics import daitaku

from .wikiru_event import WikiruEvent, WikiruEvents


@daitaku
@dataclass
class StrongestTeam(WikiruEvent):
    """An Aim! Strongest Team occurrence — recurring competition (~1-week window), rushable.

    Distinct from League of Heroes (#9) — confirmed not the same event.
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
        # TODO(#13): once the reward pattern is curated, add a
        # `stamp_strongest_team_rewards` rule and stamp it here (see SkillTests).
        return self._build_events()
