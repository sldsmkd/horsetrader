from enum import Enum


class MonthHalf(Enum):
    """The early or late half of a career-calendar month."""

    EARLY = "early"
    LATE = "late"

    def match(self, query: str) -> bool:
        return query.lower() in self.value
