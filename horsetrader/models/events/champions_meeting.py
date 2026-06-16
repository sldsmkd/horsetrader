from dataclasses import dataclass, field

from ethicrawl import ResourceList, Url

from horsetrader.core import Config, Period, Periods, SingletonMeta, StableKey
from horsetrader.extractors.gametora import Gametora
from horsetrader.extractors.static import Static, store
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.output._records import CMRecord
from horsetrader.semantics import daitaku
from horsetrader.services import News, NewsArticle

from .event import Event
from .events import Events

logger = Logger.get(__name__)


@daitaku
@dataclass
class ChampionsMeeting(Event):
    """A Champions Meeting occurrence — a dated competition window.

    The JP `Period` comes from the Gametora JA index at extraction; an EN
    `Period` is added during enrichment when the occurrence has reached the
    Global server (curated in `champions_meetings.yaml`). `name` is the EN
    cup / category label from the locale-less Gametora index ("Taurus Cup",
    "DIRT", …); track metadata is intentionally not modelled here.

    Deliberately carries **no rewards**: CM payouts are performance-dependent
    (they vary with the player's tournament result), so the front end computes
    them from player input. Don't add reward inference here the way banners do.
    """

    name: str | None = None
    banner: Image | None = field(default=None, kw_only=True)

    def match(self, query: str) -> bool:
        return super().match(query) or (
            self.name is not None and query.lower() in self.name.lower()
        )

    def bake(self, period: Period) -> CMRecord:
        # `CMRecord`'s tag is "cm" — the concise discriminator matching the
        # stable-key prefix, not the class-derived "championsmeeting".
        fields = self._envelope(period)
        if self.banner:
            fields["banner"] = str(self.banner.url)
        return CMRecord(
            **fields,
            name=self.name,
        )


@daitaku
class ChampionsMeetings(Events[ChampionsMeeting], metaclass=SingletonMeta):
    def search(self, query) -> list[ChampionsMeeting]:
        return super().search(query)

    def _validate_item(self, item: ChampionsMeeting) -> None:
        if item.name is None:
            logger.warning("Champions Meeting %s has no EN name", item.key)

    def _enrichers(self):

        def _add_utc_period(cm: ChampionsMeeting) -> None:
            period = Static().cm_period(cm.key)
            if period is not None:
                cm.periods.append(period)
                cm.references.add(store.source())
            flags = Static().event_flags(str(cm.key))
            if flags:
                cm.apply_flags(flags)
                cm.references.add(store.source())

        return (_add_utc_period,)

    def _fetch_primary(self) -> list[ChampionsMeeting]:
        records = Gametora().champions_meetings()
        meetings = [
            ChampionsMeeting(
                key=StableKey(record["key"]),
                periods=Periods([record["period"]]),
                name=record["name"],
                references=References(record.get("references", [])),
            )
            for record in records
        ]
        self._assign_banners(meetings)
        return meetings

    @staticmethod
    def _assign_banners(meetings: list[ChampionsMeeting]) -> None:
        articles_by_key: dict[str, NewsArticle] = {}
        news = News()
        for meeting in meetings:
            if meeting.name is None or not meeting.periods:
                continue
            article = news.champions_meeting(meeting.name, meeting.periods[0].start)
            if article is None or article.banner_image_url is None:
                continue
            articles_by_key[str(meeting.key)] = article

        images = ChampionsMeetings._process_banners(articles_by_key)
        for meeting in meetings:
            article = articles_by_key.get(str(meeting.key))
            if article is None or article.banner_image_url is None:
                continue
            image = images.get(article.banner_image_url)
            if image is None:
                continue
            meeting.banner = image
            meeting.references.add(article.url)
            meeting.references.add(image.references)

    @staticmethod
    def _process_banners(
        articles_by_key: dict[str, NewsArticle]
    ) -> dict[str, Image | None]:
        outdir = Config().static / "img" / "misc"
        requests: ResourceList[ImageRequest] = ResourceList()
        for key, article in articles_by_key.items():
            image_url = article.banner_image_url
            if image_url is None:
                continue
            requests.append(
                ImageRequest(
                    url=Url(image_url),
                    outfile=outdir / f"{key}-banner.webp",
                )
            )
        if not requests:
            return {}
        return CurrenChan().process(requests)
