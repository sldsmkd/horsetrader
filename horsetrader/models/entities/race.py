from dataclasses import dataclass
from typing import Any, ClassVar

from ethicrawl import ResourceList

from horsetrader.core import Config, Japlish, SingletonMeta, StableKey
from horsetrader.enums import RaceGrade, Sources, Surface
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
class Race(Entity):
    """A real-world race fixture — e.g. 東京優駿 / Japan Derby, keyed
    `race-<banner-id>` (the id in the Gametora banner art).

    The named-fixture layer of the race domain: a `Race` is run on a `Racetrack`
    at a surface + distance, with a grade band. Its primary job is the JP↔EN
    name (the bulk of the translation gap) plus the domain attributes acquired
    for free. The in-game career-occurrence dimension (which of the three career
    years it runs in, and the JRA-aligned month) and the exact `Course`
    (inner/outer) it pins to are not yet modelled. Only the real fixtures
    (Pre-Open … G1) exist here — the gamey calendar-less pseudo-races
    (Debut/Maiden/Exhibition) are filtered out at extraction.
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

    def match(self, query: str) -> bool:
        return (
            super().match(query)
            or self.name.match(query)
            or self.grade.match(query)
            or self.surface.match(query)
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
        return {
            **super().stats(),
            "missing_en": self._missing_en_count,
            "missing_banner": self._missing_banner_count,
            "missing_racetrack": self._missing_racetrack_count,
        }

    def search(self, query) -> list[Race]:
        return super().search(query)

    def _validate_item(self, item: Race) -> None:
        try:
            item.name.en
        except ValueError:
            self._missing_en_count += 1
        if item.banner is None:
            self._missing_banner_count += 1
            logger.debug(f"Race {item.key} has no banner")

    def _fetch_primary(self) -> list[Race]:
        rt_by_jp = {rt.name.jp: rt for rt in Racetracks().values()}
        records = list(Gametora().races())
        banners = self._process_banners(records)

        races: list[Race] = []
        for record in records:
            banner_url = record.get("banner_url")
            banner = banners.get(banner_url) if banner_url else None

            references = References(record.get("references", []))
            if banner is not None:
                references.add(banner.references)

            races.append(
                Race(
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
            )
        return races

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
