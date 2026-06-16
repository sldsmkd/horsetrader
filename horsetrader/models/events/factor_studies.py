from dataclasses import dataclass, field

from horsetrader.core import Period
from horsetrader.models.media import Image
from horsetrader.models.rewards import stamp_factor_studies_rewards
from horsetrader.output._records import FactorStudiesRecord
from horsetrader.semantics import daitaku

from ._misc_banner import process_misc_banner
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

    banner: Image | None = field(default=None, kw_only=True)
    _RECORD = FactorStudiesRecord

    def bake(self, period: Period) -> FactorStudiesRecord:
        return FactorStudiesRecord(
            **self._envelope(period),
            name=self.name,
            banner=str(self.banner.url) if self.banner else None,
        )


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
        self._assign_banner(studies)
        stamp_factor_studies_rewards(studies)
        return studies

    @staticmethod
    def _assign_banner(studies: list[FactorStudies]) -> None:
        image = process_misc_banner("event-factors.png")
        if image is None:
            return

        for study in studies:
            study.banner = image
            study.references.add(image.references)
