from dataclasses import dataclass, field
from typing import Any, ClassVar

from ethicrawl import ResourceList

from horsetrader.core import Config, Japlish, SingletonMeta, StableKey
from horsetrader.enums import (
    CareerClass,
    CourseVariant,
    MonthHalf,
    RaceGrade,
    Sources,
    Surface,
)
from horsetrader.extractors.gametora import Gametora
from horsetrader.extractors.static import Static
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.semantics import digitan

from .course import Course, Courses
from .entities import Entities
from .entity import Entity
from .racetrack import Racetrack, Racetracks

logger = Logger.get(__name__)

_AMBIGUOUS_COURSE_VARIANTS = {
    ("racetrack-kyoto", Surface.TURF, 1400): CourseVariant.OUTER,
    ("racetrack-kyoto", Surface.TURF, 1600): CourseVariant.OUTER,
    ("racetrack-niigata", Surface.TURF, 2000): CourseVariant.OUTER,
}


@digitan
@dataclass(frozen=True)
class RaceOccurrence:
    """One fixed appearance of a named race in the three-year career calendar.

    `course` is absent only for fixtures whose venue/distance is generated from
    the trainee's career (currently the JBC trio). Debut, Maiden, and EX are
    generated pseudo-races rather than occurrences of a named `Race`.
    """

    course: Course | None
    career_class: CareerClass
    month: int
    half: MonthHalf

    def __post_init__(self) -> None:
        if not 1 <= self.month <= 12:
            raise ValueError(f"Race occurrence month must be 1-12; got {self.month}")


@digitan
@dataclass
class Race(Entity):
    """A real-world race fixture — e.g. 東京優駿 / Japan Derby, keyed
    `race-<banner-id>` (the id in the Gametora banner art).

    The named-fixture layer of the race domain: a `Race` is run on a `Racetrack`
    at a surface + distance, with a grade band. Its `occurrences` say exactly
    where it appears in the three-year career calendar and which `Course`
    (including inner/outer) it uses. Only the real fixtures (Pre-Open … G1)
    exist here — generated Debut/Maiden/EX pseudo-races remain outside it.
    """

    KEY_PREFIX: ClassVar[str] = "race-"
    name: Japlish
    grade: RaceGrade
    surface: Surface
    # `distance`/`racetrack` are None for fixtures the game runs at a randomly
    # generated distance/venue to suit the runner's career (the JBC trio — real
    # G1s, but no fixed course). `surface` stays fixed even for those.
    distance: int | None = None
    racetrack: Racetrack | None = None
    banner: Image | None = None
    occurrences: list[RaceOccurrence] = field(default_factory=list)
    # Curated JRA abbreviations the game's mission titles use (ホープフルS for
    # ホープフルステークス). Folded into `match` so a contracted token resolves
    # to the fixture — the join Shuttle's translator leans on (#63).
    aliases: list[str] = field(default_factory=list, kw_only=True)

    def match(self, query: str) -> bool:
        return (
            super().match(query)
            or self.name.match(query)
            or self.grade.match(query)
            or self.surface.match(query)
            or any(query.lower() in alias.lower() for alias in self.aliases)
            or (self.racetrack is not None and self.racetrack.match(query))
        )


@digitan
class Races(Entities[Race], metaclass=SingletonMeta):
    SOURCES = (
        "https://gametora.com/ja/umamusume/races",
        "https://gametora.com/umamusume/races",
    )

    def __init__(self) -> None:
        self._missing_en_count = 0
        self._missing_banner_count = 0
        self._missing_racetrack_count = 0
        super().__init__()

    def stats(self) -> dict[str, Any]:
        occurrences = [
            occurrence
            for race in self.values()
            for occurrence in race.occurrences
        ]
        return {
            **super().stats(),
            "missing_en": self._missing_en_count,
            "missing_banner": self._missing_banner_count,
            "missing_racetrack": self._missing_racetrack_count,
            "occurrences": len(occurrences),
            "adaptive_occurrences": sum(o.course is None for o in occurrences),
        }

    def search(self, query) -> list[Race]:
        return super().search(query)

    def _validate_item(self, item: Race) -> None:
        if not item.occurrences:
            raise ValueError(f"Race {item.key} has no career occurrence")
        slots = [
            (o.career_class, o.month, o.half)
            for o in item.occurrences
        ]
        if len(slots) != len(set(slots)):
            raise ValueError(f"Race {item.key} has duplicate career occurrences")
        try:
            item.name.en
        except ValueError:
            self._missing_en_count += 1
        if item.banner is None:
            self._missing_banner_count += 1
            logger.debug(f"Race {item.key} has no banner")

    def _enrichers(self):
        return (self._enrich_with_aliases,)

    def _enrich_with_aliases(self, r: Race) -> None:
        """Fold curated JRA abbreviations onto the race (search phrases)."""
        r.aliases = Static().search_aliases().get(r.key, [])

    def _validate_collection(self) -> None:
        """Every curated `race-` alias target must name a real race."""
        missing = {
            target
            for target in Static().search_aliases()
            if target.startswith(Race.KEY_PREFIX) and target not in self
        }
        if missing:
            raise ValueError(
                f"search_aliases.yaml race target(s) match no race: {sorted(missing)}"
            )

    def _fetch_primary(self) -> list[Race]:
        racetracks = Racetracks()
        courses = Courses()
        rt_by_jp = {rt.name.jp: rt for rt in racetracks.values()}
        courses_by_signature: dict[
            tuple[str, Surface, int], list[Course]
        ] = {}
        for course in courses.values():
            signature = (
                str(course.racetrack.key),
                course.surface,
                course.distance,
            )
            courses_by_signature.setdefault(signature, []).append(course)
        records = list(Gametora().races())
        banners = self._process_banners(records)

        races: list[Race] = []
        for record in records:
            banner_url = record.get("banner_url")
            banner = banners.get(banner_url) if banner_url else None

            references = References(record.get("references", []))
            if banner is not None:
                references.add(banner.references)

            race = Race(
                key=StableKey(record["key"]),
                name=self._build_name(record),
                grade=RaceGrade(record["grade"]),
                surface=Surface.from_jp(record["surface_jp"]),
                distance=record["distance"],
                racetrack=self._resolve_racetrack(record, rt_by_jp),
                banner=banner,
                correlations=dict(record.get("correlations", {})),
                references=references,
            )
            course = self._resolve_course(race, courses_by_signature)
            race.occurrences = [
                RaceOccurrence(
                    course=course,
                    career_class=CareerClass(occurrence["career_class"]),
                    month=occurrence["month"],
                    half=MonthHalf(occurrence["half"]),
                )
                for occurrence in record["occurrences"]
            ]
            races.append(race)
        return races

    @staticmethod
    def _resolve_course(
        race: Race,
        courses_by_signature: dict[tuple[str, Surface, int], list[Course]],
    ) -> Course | None:
        """Resolve a fixture to its exact course, failing loud on new ambiguity."""
        if race.racetrack is None or race.distance is None:
            return None
        signature = (str(race.racetrack.key), race.surface, race.distance)
        candidates = courses_by_signature.get(signature, [])
        if len(candidates) == 1:
            return candidates[0]
        if not candidates:
            raise ValueError(f"Race {race.key}: no course matches {signature!r}")
        variant = _AMBIGUOUS_COURSE_VARIANTS.get(signature)
        matches = [course for course in candidates if course.variant == variant]
        if len(matches) != 1:
            raise ValueError(
                f"Race {race.key}: ambiguous course {signature!r}; "
                f"candidates={[str(course.key) for course in candidates]}"
            )
        return matches[0]

    def _resolve_racetrack(
        self, record: dict, rt_by_jp: dict[str, Racetrack]
    ) -> Racetrack | None:
        """Resolve the JP racetrack name to an entity. None is legitimate (the
        race runs at a randomly generated venue); a non-None name that doesn't
        match is a data gap — warn but keep the race (the name is the point)."""
        name_jp = record.get("racetrack_name_jp")
        if name_jp is None:
            return None
        racetrack = rt_by_jp.get(name_jp)
        if racetrack is None:
            self._missing_racetrack_count += 1
            logger.warning(
                "Race %s (%s): racetrack %r not in racetracks",
                record.get("key"),
                record.get("name_jp"),
                name_jp,
            )
        return racetrack

    @staticmethod
    def _build_name(record: dict) -> Japlish:
        """JP is the substrate (the JA index); EN overlays as a translation slot.
        A race not yet on Global has no EN row — it bakes JP-only and surfaces in
        the translation-gap warning, which is the intended signal."""
        name = Japlish(record["name_jp"], encoding="jp")
        name_en = record.get("name_en")
        if name_en:
            name.en = name_en
        return name

    @staticmethod
    def _process_banners(records: list[dict]) -> dict[str, Image | None]:
        outdir = Config().static / "img" / "races"
        requests: ResourceList[ImageRequest] = ResourceList()
        for record in records:
            key = record.get("key")
            banner_url = record.get("banner_url")
            if not key or not banner_url:
                continue
            requests.append(
                ImageRequest(
                    url=banner_url,
                    outfile=outdir / f"{key}_banner.webp",
                )
            )
        if len(requests) == 0:
            return {}
        return CurrenChan().process(requests)
