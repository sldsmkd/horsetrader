from dataclasses import dataclass, field

from ethicrawl import ResourceList, Url

from horsetrader.core import Config, Period, SingletonMeta, StableKey
from horsetrader.extractors.static import store
from horsetrader.info import Logger
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.models.rewards import FreeCarats, Rewards, SequenceReward
from horsetrader.output._records import AnniversaryMissionRecord
from horsetrader.semantics import daitaku
from horsetrader.services import News, NewsArticle

from .anniversary import classify_anniversary_mission
from .events import Events
from .mission import Mission, scraped_missions

logger = Logger.get(__name__)


def _celebration_rewards(key: StableKey) -> SequenceReward | None:
    """The celebration FreeCarats `login` sequence curated for this mission in
    `anniversaries.yaml`, or None if it carries no login bonus.

    A plain read — the sequence is final in the data (the anniversary-day mailbox
    present is already folded into the main part's day-0 there, since the baked
    shape carries one sequence per event; see the yaml header). Anchored at the
    part start, same basis as the login days."""
    login = store.shared(str(key)).get("login")
    if not login:
        return None
    return SequenceReward(reward_type=FreeCarats, sequence=tuple(login))


@daitaku
@dataclass
class AnniversaryMission(Mission):
    """A mission that is part of an anniversary celebration campaign.

    Structurally a `Mission` (the same scraped shape — title, periods, the
    scraped reward subset), but a distinct *class*. It carries a reference *up*
    to its anniversary (`anniversary-N_M`) and its `part` (`第N弾` → 1 = the
    countdown that opens before the date, 2 = the wave on the date, 3 = the
    continuation after; every part closes on one shared deadline).

    These are the anniversary's reward footprint: premium, multi-currency
    (carats + gacha tickets + crystal shards, plus unmodelled selectors /
    textbooks), a marketing beat designed to re-engage — not the flat carat
    chores of `Mission`. The link points up, so the `Anniversary` never reaches
    for these (no greedy cross-collection mutation); they self-classify out of
    the shared scrape and tag themselves.
    """

    anniversary: StableKey = field(kw_only=True)
    part: int = field(kw_only=True)
    banner: Image | None = field(default=None, kw_only=True)

    def bake(self, period: Period) -> AnniversaryMissionRecord:
        return AnniversaryMissionRecord(
            **self._envelope(period),
            name=self.title,
            image=str(self.image.url) if self.image else None,
            banner=str(self.banner.url) if self.banner else None,
            anniversary=self.anniversary,
            part=self.part,
        )


@daitaku
class AnniversaryMissions(Events[AnniversaryMission], metaclass=SingletonMeta):
    """The anniversary celebration missions — the special-mission class split out
    of `Missions`. Both collections partition the one scraped mission substrate
    by `classify_anniversary_mission`; this side takes the classified records and
    tags each with its `anniversary-N_M` key and `第N弾` part."""

    def search(self, query) -> list[AnniversaryMission]:
        return super().search(query)

    def _validate_item(self, item: AnniversaryMission) -> None:
        if not item.periods:
            logger.warning("Anniversary mission %s has no period", item.key)

    def _fetch_primary(self) -> list[AnniversaryMission]:
        missions: list[AnniversaryMission] = []
        for r in scraped_missions():
            tag = classify_anniversary_mission(r["title"].jp)
            if tag is None:
                continue
            anniversary, part = tag
            # The scraped completion rewards stand; the curated celebration login
            # bonus (with the anniversary-day present folded in) rides alongside as
            # a separate FreeCarats sequence — they're distinct income, not a sum.
            rewards = Rewards(r["rewards"] or [])
            celebration = _celebration_rewards(r["key"])
            if celebration is not None:
                rewards.append(celebration)
            mission = AnniversaryMission(
                key=r["key"],
                periods=r["periods"],
                title=r["title"],
                rewards=rewards or None,
                references=r["references"],
                image=r["image"],
                anniversary=anniversary,
                part=part,
            )
            if r["flags"]:
                mission.apply_flags(r["flags"])
            missions.append(mission)
        self._assign_banners(missions)
        return missions

    @staticmethod
    def _assign_banners(missions: list[AnniversaryMission]) -> None:
        articles_by_key: dict[str, NewsArticle] = {}
        news = News()
        for mission in missions:
            if not mission.periods:
                continue
            article = news.anniversary_campaign(
                str(mission.anniversary),
                mission.part,
                mission.periods[0].start,
            )
            if article is None or article.banner_image_url is None:
                continue
            articles_by_key[str(mission.key)] = article

        images = AnniversaryMissions._process_banners(articles_by_key)
        for mission in missions:
            article = articles_by_key.get(str(mission.key))
            if article is None or article.banner_image_url is None:
                continue
            image = images.get(article.banner_image_url)
            if image is None:
                continue
            mission.banner = image
            mission.references.add(article.url)
            mission.references.add(image.references)

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
