from dataclasses import dataclass, field

from ethicrawl import ResourceList, Url

from horsetrader.core import Config, Japlish, Period, Periods, SingletonMeta, StableKey
from horsetrader.extractors.static import Static
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.output._records import ScenarioRecord
from horsetrader.semantics import daitaku

from .event import Event
from .events import Events

logger = Logger.get(__name__)


@daitaku
@dataclass
class Scenario(Event):
    """A major scenario release date."""

    title: Japlish | None = None
    art: Image | None = field(default=None, kw_only=True)
    thumb: Image | None = field(default=None, kw_only=True)

    def match(self, query: str) -> bool:
        return super().match(query)

    def bake(self, period: Period) -> ScenarioRecord:
        # A major scenario release date — a real timeline event, not a gap.
        # Same envelope + title/art/thumb shape as a Story, minus the
        # banner/contents a story carries.
        return ScenarioRecord(
            **self._envelope(period),
            title=self.title.display if self.title else None,
            image=str(self.thumb.url) if self.thumb else None,
            art=str(self.art.url) if self.art else None,
        )


@daitaku
class Scenarios(Events[Scenario], metaclass=SingletonMeta):
    def search(self, query) -> list[Scenario]:
        return super().search(query)

    def _validate_item(self, item: Scenario) -> None:
        if item.art is None:
            logger.warning("Scenario %s has no art", item.key)

    def _fetch_primary(self) -> list[Scenario]:
        records = Static().scenarios()

        url_by_key = [
            (r["key"], r["art_url"])
            for r in records
            if r.get("art_url")
        ]
        art_images = self._process_images(url_by_key)
        thumb_images = self._process_images(url_by_key, width=256)

        scenarios: list[Scenario] = []
        for record in records:
            art_url = record.get("art_url")
            art = art_images.get(art_url) if art_url else None
            thumb = thumb_images.get(art_url) if art_url else None

            title_jp = record["title_jp"]
            title_en = record["title_en"]
            title: Japlish | None = None
            if title_jp or title_en:
                title = Japlish(title_jp or title_en, encoding="jp" if title_jp else "en")
                if title_en and title_jp:
                    try:
                        title.en = title_en
                    except ValueError as exc:
                        logger.warning("Bad EN title for %s: %s", record["key"], exc)

            periods = Periods([record["period"]])
            en_record = record.get("en")
            if en_record is not None:
                periods.append(en_record["period"])
                if title is not None and en_record.get("title_en"):
                    try:
                        title.en = en_record["title_en"]
                    except ValueError as exc:
                        logger.warning("Bad localized EN title for %s: %s", record["key"], exc)

            references = References([record["source"]])
            if art is not None:
                references.add(art.references)

            scenarios.append(
                Scenario(
                    key=StableKey(record["key"]),
                    periods=periods,
                    title=title,
                    art=art,
                    thumb=thumb,
                    references=references,
                )
            )
        return scenarios

    @staticmethod
    def _process_images(
        url_by_key: list[tuple[str, str]],
        width: int | None = None,
    ) -> dict[str, Image | None]:
        outdir = Config().site / "img" / "scenarios"
        requests: ResourceList[ImageRequest] = ResourceList()
        for key, art_url in url_by_key:
            stem = f"{key}_thumb" if width else key
            requests.append(
                ImageRequest(
                    url=Url(art_url),
                    outfile=outdir / f"{stem}.webp",
                    width=width,
                )
            )
        if not requests:
            return {}
        return CurrenChan().process(requests)
