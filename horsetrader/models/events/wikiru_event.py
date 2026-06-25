from dataclasses import dataclass
from typing import ClassVar, TypeVar, cast

from horsetrader.core import Period, Periods, SingletonMeta, StableKey
from horsetrader.extractors.static import Static, store
from horsetrader.extractors.wikiru import Wikiru
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.output._records import NamedEventRecord
from horsetrader.semantics import daitaku

from .event import Event, Rushable
from .events import Events

logger = Logger.get(__name__)


@daitaku
@dataclass
class WikiruEvent(Rushable, Event):
    """Base for a *recurring* wikiru-scraped event (Trainer Skills Test, Racing
    Carnival, Dream Team, Masters Challenge, …).

    The shared shape: JP runs scraped from the wikiru event index, EN windows
    left to the `FallthroughPredictor` (no dedicated predictor), a uniform
    full-clear reward pattern stamped by the collection, and a constant EN
    display `name` (the ordinal lives in the stable key). Rushable by default —
    a type that isn't (e.g. a long-season event) should subclass `Event`
    instead. Each concrete subclass sets `_RECORD` to its wire record.

    The finite/curated Showtime is deliberately NOT on this base — it carries a
    per-occurrence EN overlay and per-event rewards, which this recurring shape
    doesn't.
    """

    name: str | None = None
    _RECORD: ClassVar[type[NamedEventRecord]]

    def match(self, query: str) -> bool:
        return super().match(query) or (
            self.name is not None and query.lower() in self.name.lower()
        )

    def bake(self, period: Period) -> NamedEventRecord:
        return self._RECORD(**self._envelope(period), name=self.name)


TWikiruEvent = TypeVar("TWikiruEvent", bound=WikiruEvent)


@daitaku
class WikiruEvents(Events[TWikiruEvent], metaclass=SingletonMeta):
    """Collection base for the recurring wikiru-scraped event types.

    A subclass sets four class vars — `_HEADING` (the wikiru section heading
    text), `_KEY_PREFIX` (stable-key prefix → `<prefix>-NNN`), `_EN_NAME` (the
    constant EN display label), and `_MODEL` (the concrete `WikiruEvent`) — and,
    once the reward pattern is known, overrides `_stamp_rewards`.
    """

    _HEADING: ClassVar[str]
    _KEY_PREFIX: ClassVar[str]
    _EN_NAME: ClassVar[str]
    _MODEL: ClassVar[type[WikiruEvent]]

    def _validate_item(self, item: WikiruEvent) -> None:
        if not item.periods:
            logger.warning("%s %s has no period", self._KEY_PREFIX, item.key)

    def _build_events(self) -> list[TWikiruEvent]:
        """Shared fetch: scrape the section and build occurrence models.

        Not named `_fetch_primary` on purpose — this base must stay an
        unregistered intermediate (the `TracenModels` registry only skips
        classes whose `_fetch_primary` is still abstract). Each concrete
        subclass provides a one-line `_fetch_primary` delegating here, and
        stamps its own rewards on the result once the pattern is curated.
        """
        events = []
        for record in Wikiru().occurrences(self._HEADING, self._KEY_PREFIX):
            event = self._MODEL(
                key=StableKey(record["key"]),
                periods=Periods([record["period"]]),
                name=self._EN_NAME,
                references=References(record.get("references", [])),
            )
            flags = Static().event_flags(str(event.key))
            if flags:
                event.apply_flags(flags)
                event.references.add(store.source())
            events.append(event)
        # `_MODEL` is the concrete subclass's own model (bound to TWikiruEvent),
        # but it's typed `type[WikiruEvent]` because a ClassVar can't carry a
        # TypeVar; the cast restores the subclass-specific element type.
        return cast(list[TWikiruEvent], events)
