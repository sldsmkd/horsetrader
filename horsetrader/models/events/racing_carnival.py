from dataclasses import dataclass, field

from horsetrader.core import Period
from horsetrader.models.media import Image
from horsetrader.models.rewards import stamp_racing_carnival_rewards
from horsetrader.output._records import RacingCarnivalRecord
from horsetrader.semantics import daitaku

from ._misc_banner import process_misc_banner
from .wikiru_event import WikiruEvent, WikiruEvents


@daitaku
@dataclass
class RacingCarnival(WikiruEvent):
    """A Racing Carnival occurrence — recurring competition (~1-week window), rushable."""

    banner: Image | None = field(default=None, kw_only=True)
    _RECORD = RacingCarnivalRecord

    def bake(self, period: Period) -> RacingCarnivalRecord:
        return RacingCarnivalRecord(
            **self._envelope(period),
            name=self.name,
            banner=str(self.banner.url) if self.banner else None,
        )


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
        carnivals = self._build_events()
        self._assign_banner(carnivals)
        stamp_racing_carnival_rewards(carnivals)
        return carnivals

    @staticmethod
    def _assign_banner(carnivals: list[RacingCarnival]) -> None:
        image = process_misc_banner("racing-carnival.png")
        if image is None:
            return

        for carnival in carnivals:
            carnival.banner = image
            carnival.references.add(image.references)
