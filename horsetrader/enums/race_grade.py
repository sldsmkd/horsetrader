from enum import Enum

# Gametora keys a race's grade as a ribbon image (utx_txt_grade_ribbon_NN.png)
# with no decodable alt text, so the number → grade map is derived empirically
# from known races (Tokyo Daishoten = G1, Hanshin Cup = G2, …).
_RIBBON_TO_GRADE = {
    0: "debut",
    1: "maiden",
    2: "open",
    3: "g3",
    4: "g2",
    5: "g1",
    6: "pre-open",
    7: "exhibition",
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
    def from_ribbon(cls, ribbon: int) -> "RaceGrade | None":
        """Resolve a Gametora grade-ribbon image number (0–7)."""
        slug = _RIBBON_TO_GRADE.get(ribbon)
        return cls(slug) if slug is not None else None

    @property
    def is_fixture(self) -> bool:
        """True for real calendar fixtures; False for the gamey pseudo-races
        (Debut / Maiden / EX) that carry no fixed slot."""
        return self not in {RaceGrade.DEBUT, RaceGrade.MAIDEN, RaceGrade.EXHIBITION}

    def match(self, query: str) -> bool:
        return query.lower() in self.value
