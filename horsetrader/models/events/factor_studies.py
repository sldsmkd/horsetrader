from dataclasses import dataclass

from horsetrader.models.rewards import stamp_factor_studies_rewards
from horsetrader.output._records import FactorStudiesRecord
from horsetrader.semantics import daitaku

from .wikiru_event import WikiruEvent, WikiruEvents


@daitaku
@dataclass
class FactorStudies(WikiruEvent):
    """An Agnes Tachyon Factor Studies occurrence — recurring (~monthly), rushable.

    The most frequent of the standalone events. Its occasional renamed variant
    (the movie-tie-in `劇場版…` in JP) is the same event under a tie-in banner —
    Global strips such tie-ins back to the plain name — so it's just another
    occurrence carrying the constant EN label.
    """

    _RECORD = FactorStudiesRecord


@daitaku
class FactorStudiesEvents(WikiruEvents[FactorStudies]):
    _HEADING = "アグネスタキオンの因子研究"
    _KEY_PREFIX = "factorstudies"
    # Provisional EN label until an EN occurrence ships.
    _EN_NAME = "Factor Studies of Agnes Tachyon"
    _MODEL = FactorStudies

    def search(self, query) -> list[FactorStudies]:
        return super().search(query)

    def _fetch_primary(self) -> list[FactorStudies]:
        studies = self._build_events()
        stamp_factor_studies_rewards(studies)
        return studies
