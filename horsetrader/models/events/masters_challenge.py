from dataclasses import dataclass, field

from horsetrader.core import Period
from horsetrader.models.media import Image
from horsetrader.output._records import MastersChallengeRecord
from horsetrader.semantics import daitaku

from ._misc_banner import process_misc_banner
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

    banner: Image | None = field(default=None, kw_only=True)
    _RECORD = MastersChallengeRecord

    def bake(self, period: Period) -> MastersChallengeRecord:
        return MastersChallengeRecord(
            **self._envelope(period),
            name=self.name,
            banner=str(self.banner.url) if self.banner else None,
        )


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
        challenges = self._build_events()
        self._assign_banner(challenges)
        return challenges

    @staticmethod
    def _assign_banner(challenges: list[MastersChallenge]) -> None:
        image = process_misc_banner("masters-challenge.png")
        if image is None:
            return

        for challenge in challenges:
            challenge.banner = image
            challenge.references.add(image.references)
