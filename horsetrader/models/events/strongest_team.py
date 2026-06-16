from dataclasses import dataclass, field

from horsetrader.core import Period
from horsetrader.models.media import Image
from horsetrader.output._records import StrongestTeamRecord
from horsetrader.semantics import daitaku

from ._misc_banner import process_misc_banner
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

    banner: Image | None = field(default=None, kw_only=True)
    _RECORD = StrongestTeamRecord

    def bake(self, period: Period) -> StrongestTeamRecord:
        return StrongestTeamRecord(
            **self._envelope(period),
            name=self.name,
            banner=str(self.banner.url) if self.banner else None,
        )


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
        teams = self._build_events()
        self._assign_banner(teams)
        return teams

    @staticmethod
    def _assign_banner(teams: list[StrongestTeam]) -> None:
        image = process_misc_banner("strongest-team.png")
        if image is None:
            return

        for team in teams:
            team.banner = image
            team.references.add(image.references)
