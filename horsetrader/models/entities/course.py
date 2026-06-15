from dataclasses import dataclass
from typing import Any, ClassVar

from ethicrawl import ResourceList

from horsetrader.core import Config, SingletonMeta, StableKey
from horsetrader.enums import CourseVariant, Sources, Surface
from horsetrader.extractors.gametora import Gametora
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.semantics import digitan

from .entities import Entities
from .entity import Entity
from .racetrack import Racetrack, Racetracks

logger = Logger.get(__name__)


@digitan
@dataclass
class Course(Entity):
    """One configuration of a racetrack — surface × distance (× inner/outer),
    keyed `course-<gametora-id>` (e.g. `course-10501`).

    The track-configuration layer of the race domain: a `Racetrack` hosts
    several courses, and a `Race` (the named fixture) runs on exactly one. The
    metre-by-metre race-sim geometry on Gametora's detail page is deliberately
    out of scope — this is identity + the venue/surface/distance a race pins to,
    plus the diagram image. `variant` is set only where the venue offers two
    configurations at the same surface + distance.
    """

    KEY_PREFIX: ClassVar[str] = "course-"
    racetrack: Racetrack
    surface: Surface
    distance: int
    variant: CourseVariant | None = None
    diagram: Image | None = None

    def match(self, query: str) -> bool:
        return (
            super().match(query)
            or self.racetrack.match(query)
            or self.surface.match(query)
            or (self.variant is not None and self.variant.match(query))
            or query.strip().lower() in f"{self.distance}m"
        )


@digitan
class Courses(Entities[Course], metaclass=SingletonMeta):
    SOURCES = ("https://gametora.com/umamusume/racetracks",)

    def __init__(self) -> None:
        self._missing_diagram_count = 0
        self._missing_racetrack_count = 0
        super().__init__()

    def stats(self) -> dict[str, Any]:
        return {
            **super().stats(),
            "missing_diagram": self._missing_diagram_count,
            "missing_racetrack": self._missing_racetrack_count,
        }

    def search(self, query) -> list[Course]:
        return super().search(query)

    def _validate_item(self, item: Course) -> None:
        if item.diagram is None:
            self._missing_diagram_count += 1
            logger.debug(f"Course {item.key} has no diagram")

    def _fetch_primary(self) -> list[Course]:
        racetracks = Racetracks()
        records = [
            record
            for record in Gametora().courses()
            if self._has_racetrack(record, racetracks)
        ]
        diagrams = self._process_diagrams(records)

        courses: list[Course] = []
        for record in records:
            diagram_url = record.get("diagram_url")
            diagram = diagrams.get(diagram_url) if diagram_url else None

            references = References(record.get("references", []))
            if diagram is not None:
                references.add(diagram.references)

            courses.append(
                Course(
                    key=StableKey(record["key"]),
                    racetrack=racetracks[record["racetrack_key"]],
                    surface=Surface(record["surface"]),
                    distance=record["distance"],
                    variant=CourseVariant.from_en(record.get("variant")),
                    diagram=diagram,
                    correlations={Sources.GAMETORA.value: record["gametora_id"]},
                    references=references,
                )
            )
        return courses

    def _has_racetrack(self, record: dict, racetracks: Racetracks) -> bool:
        if record["racetrack_key"] in racetracks:
            return True
        self._missing_racetrack_count += 1
        logger.warning(
            "Skipping course %s: racetrack %s not found",
            record.get("key"),
            record.get("racetrack_key"),
        )
        return False

    @staticmethod
    def _process_diagrams(records: list[dict]) -> dict[str, Image | None]:
        outdir = Config().static / "img" / "courses"
        requests: ResourceList[ImageRequest] = ResourceList()
        for record in records:
            key = record.get("key")
            diagram_url = record.get("diagram_url")
            if not key or not diagram_url:
                continue
            requests.append(
                ImageRequest(
                    url=diagram_url,
                    outfile=outdir / f"{key}_diagram.webp",
                )
            )
        if len(requests) == 0:
            return {}
        return CurrenChan().process(requests)
