from enum import Enum


class CareerClass(Enum):
    """One of the three calendar years in a trainee's main career."""

    JUNIOR = "junior"
    CLASSIC = "classic"
    SENIOR = "senior"

    def match(self, query: str) -> bool:
        return query.lower() in self.value
