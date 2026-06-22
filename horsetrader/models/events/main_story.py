from dataclasses import dataclass, field

from ethicrawl import ResourceList, Url

from horsetrader.core import Config, Japlish, Period, Periods, SingletonMeta, StableKey
from horsetrader.extractors.static import Static
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.entities import Support, Supports, Trainee, Trainees
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.models.rewards import FreeCarats, Rewards
from horsetrader.output._records import MainStoryRecord
from horsetrader.semantics import daitaku

from .event import Event
from .events import Events

logger = Logger.get(__name__)

# Both banner sources (local Game8 PNGs and remote akamai thumbnails) normalise to
# one width so the bundle is visually consistent; CurrenChan rescales by width and
# preserves aspect, so the small local/remote AR gap leaves a harmless height
# difference (see main_story.yaml's BANNERS note). No upscaling — both sources are
# wider than this.
MAIN_BANNER_WIDTH = 512


@daitaku
@dataclass
class MainStory(Event):
    """A main-story (メインストーリー) chapter release — a single-day welfare milestone.

    Unlike a limited story EVENT, the main story is a PERMANENT campaign: clearing a
    chapter hands a one-time welfare grant (a combo of support cards plus, on the part
    finales, a ★3 trainee — in `contents`) plus its flattened story-clear carats (on the
    shared `rewards` envelope), on a single release day (a span-0 launch point).
    """

    title: Japlish | None = None
    banner: Image | None = field(default=None, kw_only=True)
    contents: list[Support | Trainee] = field(default_factory=list, kw_only=True)

    def match(self, query: str) -> bool:
        return (
            super().match(query)
            or (self.title is not None and self.title.match(query))
            or any(c.match(query) for c in self.contents)
        )

    def bake(self, period: Period) -> MainStoryRecord:
        return MainStoryRecord(
            **self._envelope(period),
            title=self.title,
            # The welfare grant — the support/trainee cards the chapter hands out.
            contents=[c.key for c in self.contents],
            banner=str(self.banner.url) if self.banner else None,
        )


@daitaku
class MainStories(Events[MainStory], metaclass=SingletonMeta):
    def search(self, query) -> list[MainStory]:
        return super().search(query)

    def _validate_item(self, item: MainStory) -> None:
        if not item.periods:
            logger.warning("Main story %s has no periods", item.key)
        # Every chapter grants at least one welfare card, so an empty list signals a
        # data-quality miss (a reward key didn't resolve), like the story check.
        if not item.contents:
            logger.warning("Main story %s has no resolvable welfare contents", item.key)
        if item.banner is None:
            logger.warning("Main story %s has no banner", item.key)

    def _fetch_primary(self) -> list[MainStory]:
        records = Static().main_story()
        banner_images = self._process_banners(records)
        supports = Supports()
        trainees = Trainees()

        stories: list[MainStory] = []
        for record in records:
            title = self._title(record)
            periods = Periods([record["period"]])
            en = record.get("en")
            if en is not None:
                periods.append(en["period"])
                if title is not None and en.get("title_en"):
                    try:
                        title.en = en["title_en"]
                    except ValueError as exc:
                        logger.warning("Bad EN title for %s: %s", record["key"], exc)

            contents = self._resolve_rewards(
                record["key"], record["rewards"], supports, trainees
            )

            references = References([record["source"]])
            if en is not None:
                references.add(en["source"])
            banner = banner_images.get(record["key"])
            if banner is not None:
                references.add(banner.references)

            stories.append(
                MainStory(
                    key=StableKey(record["key"]),
                    periods=periods,
                    title=title,
                    banner=banner,
                    contents=contents,
                    rewards=Rewards([FreeCarats(record["carats"])]),
                    references=references,
                )
            )
        return stories

    @staticmethod
    def _title(record: dict) -> Japlish | None:
        title_jp = record["title_jp"]
        title_en = record["title_en"]
        if not (title_jp or title_en):
            return None
        title = Japlish(title_jp or title_en, encoding="jp" if title_jp else "en")
        if title_en and title_jp:
            try:
                title.en = title_en
            except ValueError as exc:
                logger.warning("Bad EN title for %s: %s", record["key"], exc)
        return title

    @staticmethod
    def _resolve_rewards(
        key: str, reward_keys: list[str], supports: Supports, trainees: Trainees
    ) -> list[Support | Trainee]:
        contents: list[Support | Trainee] = []
        for rk in reward_keys:
            if rk.startswith(Support.KEY_PREFIX):
                entity: Support | Trainee | None = supports.get(StableKey(rk))
            elif rk.startswith(Trainee.KEY_PREFIX):
                entity = trainees.get(StableKey(rk))
            else:
                logger.warning("Main story %s: unknown reward key %s", key, rk)
                continue
            if entity is None:
                logger.warning("Main story %s: reward %s did not resolve", key, rk)
                continue
            contents.append(entity)
        return contents

    @staticmethod
    def _process_banners(records: list[dict]) -> dict[str, Image | None]:
        """Resolve each chapter's banner to a processed Image, keyed by stable key.

        A `banner:` value starting with `http(s)://` is a remote announce URL; anything
        else is a local filename under config/img/main/ (fed via a `file://` URI, like
        the stories banner loader). Returns key -> Image so the caller joins by chapter.
        """
        outdir = Config().static / "img" / "main"
        local_dir = Config().curated / "img" / "main"
        requests: ResourceList[ImageRequest] = ResourceList()
        pairs: list[tuple[str, str]] = []
        for record in records:
            banner = record.get("banner")
            if not banner:
                continue
            if banner.startswith("http://") or banner.startswith("https://"):
                url = Url(banner)
            else:
                path = local_dir / banner
                if not path.exists():
                    logger.warning(
                        "Main story %s: local banner %s not found", record["key"], path
                    )
                    continue
                url = Url(path.as_uri())
            requests.append(
                ImageRequest(
                    url=url,
                    outfile=outdir / f"{record['key']}-banner.webp",
                    width=MAIN_BANNER_WIDTH,
                )
            )
            pairs.append((record["key"], str(url)))

        if not requests:
            return {}
        images = CurrenChan().process(requests)
        return {key: images.get(url) for key, url in pairs}
