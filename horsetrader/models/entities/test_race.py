from horsetrader.core import Japlish, StableKey
from horsetrader.enums import CourseVariant, RaceGrade, Surface

from .course import Course
from .race import Race, Races
from .racetrack import Racetrack


def _kyoto() -> Racetrack:
    return Racetrack(
        key=StableKey("racetrack-kyoto"),
        name=Japlish("京都", encoding="jp"),
        slug="kyoto",
    )


def test_resolve_course_uses_curated_outer_variant():
    racetrack = _kyoto()
    inner = Course(
        key=StableKey("course-10804"),
        racetrack=racetrack,
        surface=Surface.TURF,
        distance=1600,
        variant=CourseVariant.INNER,
    )
    outer = Course(
        key=StableKey("course-10805"),
        racetrack=racetrack,
        surface=Surface.TURF,
        distance=1600,
        variant=CourseVariant.OUTER,
    )
    race = Race(
        key=StableKey("race-1018"),
        name=Japlish("マイルチャンピオンシップ", encoding="jp"),
        grade=RaceGrade.G1,
        surface=Surface.TURF,
        distance=1600,
        racetrack=racetrack,
    )

    assert (
        Races._resolve_course(
            race,
            {("racetrack-kyoto", Surface.TURF, 1600): [inner, outer]},
        )
        is outer
    )


def test_resolve_course_keeps_adaptive_fixture_without_course():
    race = Race(
        key=StableKey("race-1003"),
        name=Japlish("JBCクラシック", encoding="jp"),
        grade=RaceGrade.G1,
        surface=Surface.DIRT,
    )

    assert Races._resolve_course(race, {}) is None
