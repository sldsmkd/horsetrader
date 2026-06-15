from dataclasses import dataclass
from typing import Any, ClassVar

from ethicrawl import ResourceList

from horsetrader.core import Config, Japlish, SingletonMeta, StableKey
from horsetrader.extractors.gametora import Gametora
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.semantics import digitan

from .entities import Entities
from .entity import Entity

logger = Logger.get(__name__)


@digitan
@dataclass
class Racetrack(Entity):
    """A real-world Japanese racetrack — icon + JP/EN name, keyed
    `racetrack-<gametora-id>` (e.g. `racetrack-10001` for 札幌 / Sapporo).

    The 17 JRA venues a `Race` runs at. A racetrack hosts several *courses*
    (distance × surface × direction); those, and the races that pin to them,
    are modelled on `Race`, not here. This is the where, a stable reference
    entity with no timeline of its own — Events that ride a real fixture point
    at a `Race`, which points here.
    """

    KEY_PREFIX: ClassVar[str] = "racetrack-"
    name: Japlish
    # The Gametora detail-page slug (`sapporo`), identical across locales and the
    # handle the per-track course/race pages hang off. Load-bearing for the
    # upcoming `Race` fetch; not baked (the FE keys on the stable key).
    slug: str
    icon: Image | None = None

    def match(self, query: str) -> bool:
        return super().match(query) or (bool(self.name) and self.name.match(query))


@digitan
class Racetracks(Entities[Racetrack], metaclass=SingletonMeta):
    SOURCES = (
        "https://gametora.com/umamusume/racetracks",
        "https://gametora.com/ja/umamusume/racetracks",
    )

    def __init__(self) -> None:
        self._missing_icon_count = 0
        self._missing_jp_count = 0
        self._missing_en_count = 0
        super().__init__()

    def stats(self) -> dict[str, Any]:
        return {
            **super().stats(),
            "missing_icon": self._missing_icon_count,
            "missing_jp": self._missing_jp_count,
            "missing_en": self._missing_en_count,
        }

    def search(self, query) -> list[Racetrack]:
        return super().search(query)

    def _validate_item(self, item: Racetrack) -> None:
        if item.icon is None:
            self._missing_icon_count += 1
            logger.debug(f"Racetrack {item.key} has no icon")
        try:
            item.name.jp
        except ValueError:
            self._missing_jp_count += 1
        try:
            item.name.en
        except ValueError:
            self._missing_en_count += 1

    def _fetch_primary(self) -> list[Racetrack]:
        records = list(Gametora().racetracks())
        icons = self._process_icons(records)

        racetracks: list[Racetrack] = []
        for record in records:
            icon_url = record.get("icon_url")
            icon = icons.get(icon_url) if icon_url else None

            references = References(record.get("references", []))
            if icon is not None:
                references.add(icon.references)

            racetracks.append(
                Racetrack(
                    key=StableKey(record["key"]),
                    name=self._build_name(record),
                    slug=record["slug"],
                    icon=icon,
                    correlations=dict(record.get("correlations", {})),
                    references=references,
                )
            )
        return racetracks

    @staticmethod
    def _build_name(record: dict) -> Japlish:
        """JP is the canonical base payload (the racetracks page is a JP-first
        index); EN attaches as a translation slot. Falls back to EN-only when
        Gametora hasn't published a JP name for the icon yet.
        """
        name_jp = record.get("name_jp")
        name_en = record.get("name_en")
        if name_jp:
            name = Japlish(name_jp, encoding="jp")
            if name_en:
                name.en = name_en
            return name
        return Japlish(name_en or "", encoding="en")

    @staticmethod
    def _process_icons(records: list[dict]) -> dict[str, Image | None]:
        outdir = Config().static / "img" / "racetracks"
        requests: ResourceList[ImageRequest] = ResourceList()
        for record in records:
            key = record.get("key")
            icon_url = record.get("icon_url")
            if not key or not icon_url:
                continue
            requests.append(
                ImageRequest(
                    url=icon_url,
                    outfile=outdir / f"{key}_icon.webp",
                )
            )
        if len(requests) == 0:
            return {}
        return CurrenChan().process(requests)
