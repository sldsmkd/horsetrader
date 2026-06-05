from dataclasses import dataclass

from horsetrader.core import Period, Periods, SingletonMeta, StableKey
from horsetrader.extractors.gametora import Gametora
from horsetrader.extractors.static import Static, store
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.output._records import CMRecord
from horsetrader.semantics import daitaku

from .event import Event
from .events import Events

logger = Logger.get(__name__)


@daitaku
@dataclass
class ChampionsMeeting(Event):
    """A Champions Meeting occurrence — a dated competition window.

    The JP `Period` comes from the Gametora JA index at extraction; an EN
    `Period` is added during enrichment when the occurrence has reached the
    Global server (curated in `champions_meetings.yaml`). `name` is the EN
    cup / category label from the locale-less Gametora index ("Taurus Cup",
    "DIRT", …); track metadata is intentionally not modelled here.

    Deliberately carries **no rewards**: CM payouts are performance-dependent
    (they vary with the player's tournament result), so the front end computes
    them from player input. Don't add reward inference here the way banners do.
    """

    name: str | None = None

    def match(self, query: str) -> bool:
        return super().match(query) or (
            self.name is not None and query.lower() in self.name.lower()
        )

    def bake(self, period: Period) -> CMRecord:
        # `CMRecord`'s tag is "cm" — the concise discriminator matching the
        # stable-key prefix, not the class-derived "championsmeeting".
        return CMRecord(**self._envelope(period), name=self.name)


@daitaku
class ChampionsMeetings(Events[ChampionsMeeting], metaclass=SingletonMeta):
    def search(self, query) -> list[ChampionsMeeting]:
        return super().search(query)

    def _validate_item(self, item: ChampionsMeeting) -> None:
        if item.name is None:
            logger.warning("Champions Meeting %s has no EN name", item.key)

    def _enrichers(self):

        def _add_utc_period(cm: ChampionsMeeting) -> None:
            period = Static().cm_period(cm.key)
            if period is not None:
                cm.periods.append(period)
                cm.references.add(store.source())
            flags = Static().event_flags(str(cm.key))
            if flags:
                cm.apply_flags(flags)
                cm.references.add(store.source())

        return (_add_utc_period,)

    def _fetch_primary(self) -> list[ChampionsMeeting]:
        records = Gametora().champions_meetings()
        return [
            ChampionsMeeting(
                key=StableKey(record["key"]),
                periods=Periods([record["period"]]),
                name=record["name"],
                references=References(record.get("references", [])),
            )
            for record in records
        ]
