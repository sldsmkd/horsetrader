import pytest

from horsetrader.enums import RaceGrade

from .races import GametoraRaces


def test_occurrence_parses_jp_career_slot():
    assert GametoraRaces._occurrence(
        ["有馬記念", "クラシック級", "12月 後半"],
        "1023",
    ) == {
        "career_class": "classic",
        "month": 12,
        "half": "late",
    }


def test_occurrence_rejects_non_calendar_slot():
    with pytest.raises(ValueError, match="invalid career occurrence"):
        GametoraRaces._occurrence(
            ["URAファイナルズ決勝", "ファイナルズ", "???"],
            "9001",
        )


@pytest.mark.parametrize(
    ("badge", "grade"),
    [
        ("debut", RaceGrade.DEBUT),
        ("maiden", RaceGrade.MAIDEN),
        ("preop", RaceGrade.PRE_OPEN),
        ("op", RaceGrade.OPEN),
        ("g3", RaceGrade.G3),
        ("g2", RaceGrade.G2),
        ("g1", RaceGrade.G1),
        ("ex", RaceGrade.EXHIBITION),
    ],
)
def test_grade_badge_slugs_resolve(badge, grade):
    assert RaceGrade.from_badge(badge) is grade
