from dataclasses import dataclass, field

from horsetrader.core import Periods, SingletonMeta, StableKey
from horsetrader.extractors.static import Static
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.semantics import daitaku

from .event import Event
from .events import Events

logger = Logger.get(__name__)


@daitaku
@dataclass
class Anniversary(Event):
    """A recurring JP calendar holiday that triggers in-game content."""

    def match(self, query: str) -> bool:
        return super().match(query)


@daitaku
@dataclass
class Holiday(Event):
    """A recurring JP calendar holiday that triggers in-game content."""

    def match(self, query: str) -> bool:
        return super().match(query)


@daitaku
@dataclass
class NewYear(Holiday):
    # stable key: "new-year-YYYY"
    def match(self, query: str) -> bool:
        return super().match(query)


@daitaku
@dataclass
class GoldenWeek(Holiday):
    # stable key: "golden-week-YYYY"
    name: str | None = field(default=None, kw_only=True)

    def match(self, query: str) -> bool:
        return super().match(query) or (
            self.name is not None and query.lower() in self.name.lower()
        )


@daitaku
class Holidays(Events[Holiday], metaclass=SingletonMeta):
    def search(self, query) -> list[Holiday]:
        return super().search(query)

    def _validate_item(self, item: Holiday) -> None:
        if not item.periods:
            logger.warning("Holiday %s has no periods", item.key)

    def _fetch_primary(self) -> list[Holiday]:
        records = Static().holidays()
        holidays: list[Holiday] = []
        for record in records:
            key = str(record["key"])
            en = record.get("en")
            periods = Periods([record["period"]])
            references = References([record["source"]])
            if en is not None:
                periods.append(en["period"])
                references.add(en["source"])

            if key.startswith("new-year-"):
                holidays.append(
                    NewYear(
                        key=StableKey(key),
                        periods=periods,
                        references=references,
                    )
                )
            elif key.startswith("golden-week-"):
                holidays.append(
                    GoldenWeek(
                        key=StableKey(key),
                        periods=periods,
                        name=record.get("name"),
                        references=references,
                    )
                )
            else:
                logger.warning("Unrecognised holiday key %s; skipping", key)

        return holidays


@daitaku
class Anniversaries(Events[Anniversary], metaclass=SingletonMeta):
    def search(self, query) -> list[Anniversary]:
        return super().search(query)

    def _validate_item(self, item: Anniversary) -> None:
        if not item.periods:
            logger.warning("Anniversary %s has no periods", item.key)

    def _fetch_primary(self) -> list[Anniversary]:
        anniversaries: list[Anniversary] = []
        for record in Static().anniversaries():
            key = str(record["key"])
            en = record.get("en")
            periods = Periods([record["period"]])
            references = References([record["source"]])
            if en is not None:
                periods.append(en["period"])
                references.add(en["source"])
            anniversaries.append(
                Anniversary(
                    key=StableKey(key),
                    periods=periods,
                    references=references,
                )
            )
        return anniversaries
