from dataclasses import dataclass

from horsetrader.core import Period, Periods, SingletonMeta, StableKey
from horsetrader.extractors.static import Static, store
from horsetrader.extractors.wikiru import Wikiru
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.rewards import rewards_from_baked
from horsetrader.output._records import ShowtimeRecord
from horsetrader.semantics import daitaku

from .event import RushableEvent
from .events import Events

logger = Logger.get(__name__)


@daitaku
@dataclass
class Showtime(RushableEvent):
    """A Fuji Kiseki Showtime event occurrence — a dated availability window.

    The JP `Period` and JP `name` come from the wikiru event-index scrape; the
    EN `Period`, EN `name`, and the (region-agnostic) `rewards` are added during
    enrichment from `showtimes.yaml`. A closed two-event series — both EN dates
    are confirmed, so there is no predictor: a Showtime with no EN block simply
    wouldn't reach the baked timeline.

    Rushable: the player can post it at its start for an efficiency penalty
    rather than farming to the last day, the same capability banners and stories
    carry. (The series was never repeated — it was unpopular — which is what
    makes it the finite curated case it is.)
    """

    name: str | None = None

    def match(self, query: str) -> bool:
        return super().match(query) or (
            self.name is not None and query.lower() in self.name.lower()
        )

    def bake(self, period: Period) -> ShowtimeRecord:
        # Tag is "showtime" — the concise discriminator matching the stable-key
        # prefix. Carries rewards (folded in by `_envelope`), unlike a CM.
        return ShowtimeRecord(**self._envelope(period), name=self.name)


@daitaku
class Showtimes(Events[Showtime], metaclass=SingletonMeta):
    def search(self, query) -> list[Showtime]:
        return super().search(query)

    def _validate_item(self, item: Showtime) -> None:
        if item.name is None:
            logger.warning("Showtime %s has no name", item.key)

    def _enrichers(self):

        def _add_en_overlay(showtime: Showtime) -> None:
            entry = Static().showtime(showtime.key)
            if entry is None:
                return
            showtime.periods.append(entry["period"])
            if entry.get("name"):
                showtime.name = entry["name"]
            if entry.get("rewards"):
                showtime.rewards = rewards_from_baked(entry["rewards"])
            showtime.references.add(store.source())

        return (_add_en_overlay,)

    def _fetch_primary(self) -> list[Showtime]:
        records = Wikiru().showtimes()
        return [
            Showtime(
                key=StableKey(record["key"]),
                periods=Periods([record["period"]]),
                name=record["name"],
                references=References(record.get("references", [])),
            )
            for record in records
        ]
