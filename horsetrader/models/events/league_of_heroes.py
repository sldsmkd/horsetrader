from dataclasses import dataclass, field

from ethicrawl import ResourceList, Url

from horsetrader.core import Config, Period
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.output._records import LeagueOfHeroesRecord
from horsetrader.semantics import daitaku
from horsetrader.services import News, NewsArticle

from .wikiru_event import WikiruEvent, WikiruEvents


@daitaku
@dataclass
class LeagueOfHeroes(WikiruEvent):
    """A League of Heroes occurrence — recurring quarterly PvP (it displaces a
    Champions Meeting slot; Feb/May/Aug/Nov from 2025). Scraped from wikiru
    (Gametora has no surface for it). Rushable.

    **Rewards HELD:** PvP with *graded* rewards — the plan is to ship the full
    tier→reward map and let the player choose their target tier (the Henry
    Handsome / prototype approach; the ETL owns the values, the client owns the
    strategy). Left unstamped pending that tiered-reward type. Getting the type
    in already solves timeline density for the client, with or without rewards.
    """

    banner: Image | None = field(default=None, kw_only=True)
    _RECORD = LeagueOfHeroesRecord

    def bake(self, period: Period) -> LeagueOfHeroesRecord:
        return LeagueOfHeroesRecord(
            **self._envelope(period),
            name=self.name,
            banner=str(self.banner.url) if self.banner else None,
        )


@daitaku
class LeaguesOfHeroes(WikiruEvents[LeagueOfHeroes]):
    _HEADING = "リーグオブヒーローズ"
    _KEY_PREFIX = "leagueofheroes"
    # Provisional EN label until an EN occurrence ships.
    _EN_NAME = "League of Heroes"
    _MODEL = LeagueOfHeroes

    def search(self, query) -> list[LeagueOfHeroes]:
        return super().search(query)

    def _fetch_primary(self) -> list[LeagueOfHeroes]:
        # Rewards HELD: PvP graded payout → tier-map reward type (TODO), see
        # class docstring. The type alone adds timeline density.
        leagues = self._build_events()
        self._assign_banners(leagues)
        return leagues

    @staticmethod
    def _assign_banners(leagues: list[LeagueOfHeroes]) -> None:
        articles = News().league_of_heroes_team_building()
        if not articles:
            return

        images = LeaguesOfHeroes._process_banners(articles[: len(leagues)])
        for league, article in zip(leagues, articles):
            image_url = article.primary_image_url
            if image_url is None:
                continue
            image = images.get(image_url)
            if image is None:
                continue
            league.banner = image
            league.references.add(article.url)
            league.references.add(image.references)

    @staticmethod
    def _process_banners(articles: list[NewsArticle]) -> dict[str, Image | None]:
        outdir = Config().static / "img" / "misc"
        requests: ResourceList[ImageRequest] = ResourceList()
        for ordinal, article in enumerate(articles, start=1):
            image_url = article.primary_image_url
            if image_url is None:
                continue
            requests.append(
                ImageRequest(
                    url=Url(image_url),
                    outfile=outdir / f"leagueofheroes-{ordinal:03d}-banner.webp",
                )
            )
        if not requests:
            return {}
        return CurrenChan().process(requests)
