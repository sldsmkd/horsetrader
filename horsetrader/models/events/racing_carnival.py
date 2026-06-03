from dataclasses import dataclass

from horsetrader.output._records import RacingCarnivalRecord
from horsetrader.semantics import daitaku

from .wikiru_event import WikiruEvent, WikiruEvents


@daitaku
@dataclass
class RacingCarnival(WikiruEvent):
    """A Racing Carnival occurrence — recurring competition (~1-week window), rushable."""

    _RECORD = RacingCarnivalRecord


@daitaku
class RacingCarnivals(WikiruEvents[RacingCarnival]):
    _HEADING = "レーシングカーニバル"
    _KEY_PREFIX = "racingcarnival"
    # Provisional EN label until an EN occurrence ships.
    _EN_NAME = "Racing Carnival"
    _MODEL = RacingCarnival

    def search(self, query) -> list[RacingCarnival]:
        return super().search(query)

    def _fetch_primary(self) -> list[RacingCarnival]:
        # TODO(#12): once the reward pattern is curated, add a
        # `stamp_racing_carnival_rewards` rule and stamp it here (see SkillTests).
        return self._build_events()
