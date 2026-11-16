from enum import Enum

# Gametora keys a race's grade as a per-locale badge image
# (`/races/grades/<locale>/<slug>.png`). The alt text is the display label but is
# sometimes empty, so the filename slug is the signal. Gametora abbreviates
# (op / preop / ex); ours are the full words.
_BADGE_TO_GRADE = {
    "debut": "debut",
    "maiden": "maiden",
    "preop": "pre-open",
    "op": "open",
    "g3": "g3",
    "g2": "g2",
    "g1": "g1",
    "ex": "exhibition",
}


class RaceGrade(Enum):
    """A race's grade band. The middle five (Pre-Open … G1) are real named
    fixtures; DEBUT/MAIDEN (career-entry mechanic — Maiden is the forced rerun
    on a failed Debut) and EXHIBITION (the calendar-less URA-Finals endgame) are
    gamey pseudo-races that never sit on the fixture calendar — see `is_fixture`.

    Slugs are the full words (the in-game flashes abbreviate: Open=OP,
    Pre-Open=Pre-OP, Exhibition=EX)."""

    DEBUT = "debut"
    MAIDEN = "maiden"
    PRE_OPEN = "pre-open"
    OPEN = "open"
    G3 = "g3"
    G2 = "g2"
    G1 = "g1"
    EXHIBITION = "exhibition"

    @classmethod
    def from_badge(cls, badge: str) -> "RaceGrade | None":
        """Resolve a Gametora grade-badge image slug (`g1`, `preop`, …)."""
        slug = _BADGE_TO_GRADE.get(badge)
        return cls(slug) if slug is not None else None

    @property
    def is_fixture(self) -> bool:
        """True for real calendar fixtures; False for the gamey pseudo-races
        (Debut / Maiden / EX) that carry no fixed slot."""
        return self not in {RaceGrade.DEBUT, RaceGrade.MAIDEN, RaceGrade.EXHIBITION}

    def match(self, query: str) -> bool:
        return query.lower() in self.value
