from dataclasses import dataclass, field

from ethicrawl import ResourceList, Url

from horsetrader.core import Config, Japlish, Periods, SingletonMeta, StableKey
from horsetrader.enums import Sources
from horsetrader.extractors.gametora import Gametora
from horsetrader.extractors.gametora.story import STORY_INDEX_URL
from horsetrader.extractors.static import Static
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.entities import Support, Supports, Trainee, Trainees
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.models.rewards import (
    Rewards,
    reward_for_gametora_icon,
    stamp_story_off_table_extras,
)
from horsetrader.semantics import daitaku

from .event import Event
from .events import Events

logger = Logger.get(__name__)


@daitaku
@dataclass
class Story(Event):
    """A story-time event with a JP/EN title and run period."""

    title: Japlish | None = None
    art: Image | None = field(default=None, kw_only=True)
    banner: Image | None = field(default=None, kw_only=True)
    thumb: Image | None = field(default=None, kw_only=True)
    trainees: list[Trainee] = field(default_factory=list, kw_only=True)
    supports: list[Support] = field(default_factory=list, kw_only=True)

    def match(self, query: str) -> bool:
        return (
            super().match(query)
            or (self.title is not None and self.title.match(query))
            or any(t.match(query) for t in self.trainees)
            or any(s.match(query) for s in self.supports)
        )


@daitaku
class Stories(Events[Story], metaclass=SingletonMeta):
    SOURCES = (STORY_INDEX_URL,)

    def search(self, query) -> list[Story]:
        return super().search(query)

    def _validate_item(self, item: Story) -> None:
        if not item.periods:
            logger.warning("Story %s has no periods", item.key)

    def _enrichers(self):

        def _apply_en_overlay(story: Story) -> None:
            key = str(story.key)
            period = Static().story_period(key)
            name_override = Static().story_name_override(key)
            if period is None and name_override is None:
                return
            if period is not None:
                story.periods.append(period)
            if name_override is not None:
                if story.title is not None:
                    story.title.en = name_override
                else:
                    logger.warning(
                        "EN name override for %s ignored: no Gametora title to override", key
                    )
            story.references.add(str(Config().static / "stories.yaml"))

        return (_apply_en_overlay,)

    def _fetch_primary(self) -> list[Story]:
        records = list(Gametora().stories())
        art_images = self._process_images(records, "art_url", "")
        thumb_images = self._process_images(records, "icon_url", "-thumb")
        supports_col = Supports()

        stories: list[Story] = []
        for record in records:
            gametora_key = record["key"]
            gametora_n = int(gametora_key.rsplit("-", 1)[1])
            stable_key = StableKey(f"story-{gametora_n:03d}")

            art_url = record.get("art_url")
            art = art_images.get(art_url) if art_url else None
            icon_url = record.get("icon_url")
            thumb = thumb_images.get(icon_url) if icon_url else None

            title_jp = record.get("title_jp")
            title_en = record.get("title_en")
            title: Japlish | None = None
            text = title_jp or title_en
            if text:
                title = Japlish(text, encoding="jp" if title_jp else "en")
                if title_en and title_jp:
                    try:
                        title.en = title_en
                    except ValueError as exc:
                        logger.warning("Bad EN title for %s: %s", gametora_key, exc)

            references = References(record.get("references", []))
            if art is not None:
                references.add(art.references)
            if thumb is not None:
                references.add(thumb.references)

            trainees: list[Trainee] = []
            for char_slug in record.get("trainee_ids", []):
                results = Trainees().search(char_slug)
                if results:
                    trainees.append(results[0])
                else:
                    logger.warning("No trainee for character %s in %s", char_slug, gametora_key)

            supports: list[Support] = []
            for sup_slug in record.get("support_ids", []):
                s = supports_col.get(sup_slug)
                if s is not None:
                    supports.append(s)
                else:
                    logger.warning("No support for slug %s in %s", sup_slug, gametora_key)

            rewards = self._resolve_rewards(record.get("reward_items", []), gametora_key)

            stories.append(
                Story(
                    key=stable_key,
                    periods=Periods([record["period"]]),
                    title=title,
                    art=art,
                    thumb=thumb,
                    trainees=trainees,
                    supports=supports,
                    references=references,
                    correlations={Sources.GAMETORA.value: gametora_n},
                    rewards=rewards,
                )
            )

        self._assign_banners(stories)
        stamp_story_off_table_extras(stories)
        return stories

    @staticmethod
    def _resolve_rewards(
        reward_items: list[tuple[str, int]], gametora_key: str
    ) -> Rewards | None:
        # One Reward instance per scraped row; the bake mapper sums same-keyed
        # entries when emitting JSON, so we don't bucket here. Allowlist by
        # design: scraped icons without a typed `Reward` subclass are dropped
        # at debug — the Items collection still has them by item-id if a
        # consumer wants the long tail.
        rewards = Rewards()
        for icon_id, amount in reward_items:
            cls = reward_for_gametora_icon(icon_id)
            if cls is None:
                logger.debug(
                    "Unmapped reward icon %s in %s (x%d)", icon_id, gametora_key, amount
                )
                continue
            rewards.append(cls(amount=amount))
        return rewards or None

    def _assign_banners(self, stories: list[Story]) -> None:
        banner_records = Static().story_banners()
        if not banner_records:
            return

        # Match reference images to stories by ordinal (earliest first).
        ordered = sorted(
            (s for s in stories if s.periods),
            key=lambda s: min(p.start for p in s.periods),
        )
        outdir = Config().site / "img" / "stories"
        requests: ResourceList[ImageRequest] = ResourceList()
        pairs: list[tuple[Story, Url]] = []
        for story, br in zip(ordered, banner_records):
            url = Url(br["banner_path"].as_uri())
            requests.append(
                ImageRequest(url=url, outfile=outdir / f"{story.key}-banner.webp")
            )
            pairs.append((story, url))

        banner_images = CurrenChan().process(requests)
        for story, url in pairs:
            image = banner_images.get(str(url))
            if image is not None:
                story.banner = image
                story.references.add(image.references)

    @staticmethod
    def _process_images(
        records: list[dict], url_key: str, suffix: str
    ) -> dict[str, Image | None]:
        outdir = Config().site / "img" / "stories"
        requests: ResourceList[ImageRequest] = ResourceList()
        for record in records:
            if url := record.get(url_key):
                n = int(record["key"].rsplit("-", 1)[1])
                requests.append(
                    ImageRequest(
                        url=url,
                        outfile=outdir / f"story-{n:03d}{suffix}.webp",
                    )
                )
        if not requests:
            return {}
        return CurrenChan().process(requests)
