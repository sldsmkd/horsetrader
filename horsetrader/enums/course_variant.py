from enum import Enum


class CourseVariant(Enum):
    """The inner/outer loop a same-distance course runs (内回り / 外回り).

    Absent on most courses; present where a racetrack offers two configurations
    at the same surface + distance (e.g. Nakayama turf). `None` on the course
    means the venue has a single configuration at that distance.
    """

    INNER = "inner"
    OUTER = "outer"

    @classmethod
    def from_en(cls, text: str | None) -> "CourseVariant | None":
        """Resolve a Gametora EN variant label ("Inner", "Outer"); None when absent."""
        if not text:
            return None
        try:
            return cls(text.strip().lower())
        except ValueError:
            return None

    def match(self, query: str) -> bool:
        return query.lower() in self.value
