from dataclasses import dataclass, field
from datetime import timedelta

from ethicrawl import ResourceList, Url

from horsetrader.core import Config, JST, Japlish, Period, Periods, SingletonMeta, StableKey
from horsetrader.extractors.gametora import Gametora
from horsetrader.extractors.static import Static, store
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.entities import Trainee, Trainees
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.models.rewards import stamp_legend_race_rewards
from horsetrader.output._records import LegendLegRecord, LegendRaceRecord
from horsetrader.semantics import daitaku
from horsetrader.services import News, NewsArticle, Translate

from .event import Event
from .events import Events

logger = Logger.get(__name__)


@daitaku
@dataclass
class LegendLeg:
    """One leg of a Legend Race: a single trainee variant faced over a JST
    sub-window. Legs are ordered and contiguously subdivide the race window."""

    trainee: Trainee
    period: Period


@daitaku
@dataclass
class LegendRace(Event):
    """A Legend Race occurrence — a real-world race (Japan Cup, Satsuki Sho, …)
    run as an ordered sequence of per-trainee legs (each ~3 days) that tile the
    overall window. `title` is the race name (JP from extraction, EN joined from
    the locale-less index when it has reached Global).

    Not `Rushable`: the legs are date-pinned daily windows, so there's no
    post-at-start choice to model — same fixed-duration stance as a Champions
    Meeting. Rewards are a stamped heuristic (carats per leg, plus crystal shards
    once the reward tier improved at the 8th occurrence); see `rewards/rules.py`.
    """

    title: Japlish | None = None
    legs: list[LegendLeg] = field(default_factory=list, kw_only=True)
    banner: Image | None = field(default=None, kw_only=True)

    def match(self, query: str) -> bool:
        return (
            super().match(query)
            or (self.title is not None and self.title.match(query))
            or any(leg.trainee.match(query) for leg in self.legs)
        )

    def bake(self, period: Period) -> LegendRaceRecord:
        return LegendRaceRecord(
            **self._envelope(period),
            name=self.title,
            banner=str(self.banner.url) if self.banner else None,
            legs=self._baked_legs(period),
        )

    def _baked_legs(self, period: Period) -> list[LegendLegRecord]:
        """Re-anchor each JST leg onto the matched (EN) window by day offset.

        The scraped legs carry JST sub-windows; EN runs on different calendar
        dates, so we lay each leg out as its whole-day offset from the JST window
        start, applied from the matched window's start date. This keeps the EN
        ~3-day cadence intact and shares one basis with the carat
        `SequenceReward` (`stamp_legend_race_rewards`), so sequence index *i*
        lines up with leg *i*'s first day.
        """
        jp = next((p for p in self.periods if p.tzinfo == JST), None)
        anchor = (jp.start if jp is not None else period.start).date()
        base = period.start.date()
        legs: list[LegendLegRecord] = []
        for leg in self.legs:
            start = base + timedelta(days=(leg.period.start.date() - anchor).days)
            end = base + timedelta(days=(leg.period.end.date() - anchor).days)
            legs.append(
                LegendLegRecord(
                    trainee=str(leg.trainee.key),
                    start=start.isoformat(),
                    end=end.isoformat(),
                )
            )
        return legs


@daitaku
class LegendRaces(Events[LegendRace], metaclass=SingletonMeta):
    def search(self, query) -> list[LegendRace]:
        return super().search(query)

    def _validate_item(self, item: LegendRace) -> None:
        if not item.periods:
            logger.warning("Legend Race %s has no period", item.key)
        if not item.legs:
            logger.warning("Legend Race %s has no legs", item.key)

    def _enrichers(self):

        def _add_utc_period(race: LegendRace) -> None:
            period = Static().legend_race_period(str(race.key))
            if period is not None:
                race.periods.append(period)
                race.references.add(store.source())
            flags = Static().event_flags(str(race.key))
            if flags:
                race.apply_flags(flags)
                race.references.add(store.source())

        return (_add_utc_period,)

    def _fetch_primary(self) -> list[LegendRace]:
        trainees = Trainees()
        races: list[LegendRace] = []
        for record in Gametora().legend_races():
            legs: list[LegendLeg] = []
            for entry in record["legs"]:
                slug = entry["trainee_slug"]
                results = trainees.search(slug)
                if not results:
                    logger.warning(
                        "No trainee for %s in %s", slug, record["key"]
                    )
                    continue
                legs.append(LegendLeg(trainee=results[0], period=entry["period"]))
            if not legs:
                logger.warning("Legend Race %s has no resolvable legs", record["key"])
                continue

            title_jp = record.get("title_jp")
            title_en = record.get("title_en")
            title: Japlish | None = None
            if title_jp:
                title = Japlish(title_jp, encoding="jp")
                if title_en:
                    try:
                        title.en = title_en
                    except ValueError as exc:
                        logger.warning("Bad EN name for %s: %s", record["key"], exc)
                else:
                    # No Global EN — the title is a race name the Race entity
                    # already translates, so let Shuttle project it (#63's
                    # second bucket). No-ops on NAR races awaiting EN curation.
                    title = Translate().race(title)
            elif title_en:
                title = Japlish(title_en, encoding="en")

            races.append(
                LegendRace(
                    key=StableKey(record["key"]),
                    periods=Periods([record["period"]]),
                    title=title,
                    legs=legs,
                    references=References(record.get("references", [])),
                )
            )

        stamp_legend_race_rewards(races)
        self._assign_banners(races)
        return races

    @staticmethod
    def _assign_banners(races: list[LegendRace]) -> None:
        articles_by_key: dict[str, NewsArticle] = {}
        news = News()
        for race in races:
            if not race.periods:
                continue
            article = news.legend_race(race.periods[0].start)
            if article is None or article.banner_image_url is None:
                continue
            articles_by_key[str(race.key)] = article

        images = LegendRaces._process_banners(articles_by_key)
        for race in races:
            article = articles_by_key.get(str(race.key))
            if article is None or article.banner_image_url is None:
                continue
            image = images.get(article.banner_image_url)
            if image is None:
                continue
            race.banner = image
            race.references.add(article.url)
            race.references.add(image.references)

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
