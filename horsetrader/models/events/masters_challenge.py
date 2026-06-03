from dataclasses import dataclass

from horsetrader.output._records import MastersChallengeRecord
from horsetrader.semantics import daitaku

from .wikiru_event import WikiruEvent, WikiruEvents


@daitaku
@dataclass
class MastersChallenge(WikiruEvent):
    """A Masters Challenge occurrence — recurring, but a long ~3-month *season*
    window rather than the ~1-week competitions.

    Scaffolded as rushable for parity with its siblings, but a 3-month window
    almost certainly isn't a post-at-start-to-skip-the-grind event — **confirm
    rushability**; if not, rebase this on `Event` (and the record on
    `EventRecord`) instead of the rushable base.
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
        # TODO(#15): once the reward pattern is curated, add a
        # `stamp_masters_challenge_rewards` rule and stamp it here (see SkillTests).
        return self._build_events()
