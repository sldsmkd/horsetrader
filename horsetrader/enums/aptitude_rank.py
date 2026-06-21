from enum import Enum

# Gametora renders each aptitude as a letter-grade icon
# (media.gametora.com/umamusume/ui/rank/simple/NN.png). Even numbers are the
# whole grades 00=G … 14=S; the odd numbers in between are half-step "+" grades
# we don't model — a base trainee's aptitudes only ever sit on whole grades.
# The icon number is the canonical source; the <img alt>/title is a localized
# echo of the same letter.
_ICON_TO_RANK = {
    0: "g",
    2: "f",
    4: "e",
    6: "d",
    8: "c",
    10: "b",
    12: "a",
    14: "s",
}


class AptitudeRank(Enum):
    """A trainee's aptitude grade on one axis, G (worst) → S (best).

    Ordered worst→best so the members read as a ladder and line up with the
    `--ht-colour-aptitude-*` band in the front-end palette. Higher icon bands
    (SS / U / L) belong to runtime stat ranks and overall ratings, not base
    aptitudes, and are deliberately out of scope."""

    G = "g"
    F = "f"
    E = "e"
    D = "d"
    C = "c"
    B = "b"
    A = "a"
    S = "s"

    @classmethod
    def from_icon(cls, icon: int) -> "AptitudeRank | None":
        """Resolve a Gametora rank icon number (00–14, even). Half-step (odd)
        or out-of-range numbers resolve to `None` — base trainees never use
        them, so a `None` here marks a scrape that hit the wrong icon set."""
        slug = _ICON_TO_RANK.get(icon)
        return cls(slug) if slug is not None else None

    def match(self, query: str) -> bool:
        return query.strip().lower() == self.value
