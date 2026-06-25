from dataclasses import dataclass, field

from ethicrawl import ResourceList, Url

from horsetrader.core import Config, Period
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.output._records import StrongestTeamRecord
from horsetrader.semantics import daitaku
from horsetrader.services import News, NewsArticle

from ._misc_banner import process_misc_banner
from .wikiru_event import WikiruEvent, WikiruEvents

_GENERIC_BANNER_URL = (
    "https://assets-webview-umamusume-en.akamaized.net/contents/assets/images/"
    "uploads/Header/banner_30900001_L1782338400.png"
)


@daitaku
@dataclass
class StrongestTeam(WikiruEvent):
    """A Dream Team occurrence — recurring competition (~1-week window), rushable.

    Distinct from League of Heroes (#9) — confirmed not the same event.

    **Rewards HELD (#13):** PvP event with *graded* rewards (payout scales with
    rank), so a flat full-clear set would overstate it (the Champions Meeting
    problem). Left unstamped pending a decision on modelling graded payouts.
    """

    banner: Image | None = field(default=None, kw_only=True)
    _RECORD = StrongestTeamRecord

    def bake(self, period: Period) -> StrongestTeamRecord:
        return StrongestTeamRecord(
            **self._envelope(period),
            name=self.name,
            banner=str(self.banner.url) if self.banner else None,
        )


@daitaku
class StrongestTeams(WikiruEvents[StrongestTeam]):
    _HEADING = "目指せ！最強チーム"
    _KEY_PREFIX = "strongestteam"
    _EN_NAME = "Dream Team"
    _MODEL = StrongestTeam

    def search(self, query) -> list[StrongestTeam]:
        return super().search(query)

    def _fetch_primary(self) -> list[StrongestTeam]:
        # Rewards HELD (#13): PvP graded payout — see class docstring. Raw data
        # for when we return: 1300 carats (first occurrence) → 1500 thereafter,
        # 2 rainbow + 2 gold shards, 2 trainee + 2 support tickets (full clear).
        teams = self._build_events()
        self._assign_banner(teams)
        return teams

    @staticmethod
    def _assign_banner(teams: list[StrongestTeam]) -> None:
        generic = StrongestTeams._process_generic_banner()
        if generic is None:
            # Offline last resort for a cold cache or unavailable Akamai asset.
            generic = process_misc_banner("strongest-team.png")
        articles_by_key: dict[str, NewsArticle] = {}
        news = News()
        for team in teams:
            if not team.periods:
                continue
            article = news.strongest_team(team.periods[0].start)
            if article is None or article.banner_image_url is None:
                continue
            articles_by_key[str(team.key)] = article

        images = StrongestTeams._process_news_banners(articles_by_key)
        for team in teams:
            article = articles_by_key.get(str(team.key))
            specific = None
            if article is not None and article.banner_image_url is not None:
                specific = images.get(article.banner_image_url)
            if specific is not None:
                team.banner = specific
                team.references.add(article.url)
                team.references.add(specific.references)
            elif generic is not None:
                team.banner = generic
                team.references.add(generic.references)

    @staticmethod
    def _process_generic_banner() -> Image | None:
        url = Url(_GENERIC_BANNER_URL)
        requests: ResourceList[ImageRequest] = ResourceList(
            [
                ImageRequest(
                    url=url,
                    outfile=Config().static / "img" / "misc" / "dream-team.webp",
                )
            ]
        )
        return CurrenChan().process(requests).get(str(url))

    @staticmethod
    def _process_news_banners(
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
