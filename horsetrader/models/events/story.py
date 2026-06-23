from dataclasses import dataclass, field
from datetime import timedelta

from ethicrawl import ResourceList, Url

from horsetrader.core import JST, Config, Japlish, Period, Periods, SingletonMeta, StableKey
from horsetrader.enums import Sources
from horsetrader.extractors.gametora import Gametora
from horsetrader.extractors.gametora.story import STORY_INDEX_URL
from horsetrader.extractors.static import Static, store
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.entities import Support, Supports, Trainee, Trainees
from horsetrader.models.media import CurrenChan, Image, ImageRequest
from horsetrader.output._records import StoryRecord
from horsetrader.semantics import daitaku

from .event import Event, Rushable
from .events import Events

logger = Logger.get(__name__)

# How close in JP time a story and a banner must run to count as a promotional
# tie-in (the `Story.promotes` correlation window).
_STORY_WINDOW = timedelta(days=7)

# Story events carry NO rewards of their own — the graded Pt-reward ladder, the
# bingo, and the story-chapter carats are folded into the curated play-style
# `reward-map-story-<era>` (config/yaml/reward_structures.yaml). All a Story
# communicates is its *era*, selected by the Pt-ladder ceiling scraped off the
# detail page. The client expands the matching map at the player's tier.
_PT_CEILING_ERAS = {1_000_000: "1m", 1_500_000: "1-5m"}
# Proto-era ceilings (stories 1–5): historical, deliberately not modelled — they
# resolve to `None` silently rather than warning. (story-1 = 1.45M, 2–5 = 700k.)
_PROTO_CEILINGS = {700_000, 1_450_000}


def _era_for_ceiling(ceiling: int | None) -> str | None:
    """Map a scraped Pt-ladder ceiling to its reward era. `None` when there's no
    ladder, or for the historical proto-era ceilings (not modelled). An *unknown*
    ceiling warns rather than raises — scraped input fails soft — signalling a new
    era that needs a `reward-map-story-<era>` and an `_PT_CEILING_ERAS` entry."""
    if ceiling is None:
        return None
    era = _PT_CEILING_ERAS.get(ceiling)
    if era is None and ceiling not in _PROTO_CEILINGS:
        logger.warning(
            "Story Pt ceiling %s has no era mapping — new reward era? "
            "Add a reward-map-story-<era> and extend _PT_CEILING_ERAS",
            ceiling,
        )
    return era


@daitaku
@dataclass
class Story(Rushable, Event):
    """A story-time event with a JP/EN title and run period."""

    title: Japlish | None = None
    art: Image | None = field(default=None, kw_only=True)
    banner: Image | None = field(default=None, kw_only=True)
    thumb: Image | None = field(default=None, kw_only=True)
    trainees: list[Trainee] = field(default_factory=list, kw_only=True)
    supports: list[Support] = field(default_factory=list, kw_only=True)
    era: str | None = field(default=None, kw_only=True)
    # Event-Point-Bonus TOP tier — the story-link banner cast (both kinds), the
    # exact colink the bonus table names. `promotes` prefers these; they're the
    # precise signal vs the featured `trainees` / welfare `supports` heuristics.
    link_trainees: list[Trainee] = field(default_factory=list, kw_only=True)
    link_supports: list[Support] = field(default_factory=list, kw_only=True)

    def match(self, query: str) -> bool:
        return (
            super().match(query)
            or (self.title is not None and self.title.match(query))
            or any(t.match(query) for t in self.trainees)
            or any(s.match(query) for s in self.supports)
        )

    def promotes(self, banner) -> bool:
        """Whether this story is ``banner``'s promotional tie-in: the banner's full
        cast (every trainee AND every support on it) is a subset of the story's
        story-link cast, and the two run within ``_STORY_WINDOW`` of each other in
        JP time.

        The story-link cast is the Event-Point-Bonus TOP tier (`link_trainees` /
        `link_supports`) — the exact cards the bonus table colinks to the event —
        falling back to the featured `trainees` / welfare `supports` for older
        events that carry no bonus table. This is the story↔banner correlation
        force, owned here so both consumers share one definition: the
        `BannerPredictor` promotes a JP banner to its story's EN date, and
        `Selectors` resolves a selector's pool cutoff to the banner a seasonal
        story promotes. An empty banner never matches (an empty cast is a vacuous
        subset of everything)."""
        if not banner.contents:
            return False
        story_jp = self._jp_start()
        banner_jp = next((p.start for p in banner.periods if p.tzinfo == JST), None)
        if story_jp is None or banner_jp is None:
            return False
        if abs(story_jp - banner_jp) > _STORY_WINDOW:
            return False
        banner_trainees = {c.key for c in banner.contents if isinstance(c, Trainee)}
        banner_supports = {c.key for c in banner.contents if isinstance(c, Support)}
        return (
            banner_trainees <= {t.key for t in (self.link_trainees or self.trainees)}
            and banner_supports <= {s.key for s in (self.link_supports or self.supports)}
        )

    def _jp_start(self):
        return next((p.start for p in self.periods if p.tzinfo == JST), None)

    def bake(self, period: Period) -> StoryRecord:
        return StoryRecord(
            **self._envelope(period),
            title=self.title,
            # A story's contents are its Event Support Cards — the welfare grant. Only
            # ever supports (the 4★ trainee block is featured art, not a grant), so the
            # contents are support keys; Stories._validate_item warns if that breaks.
            contents=[s.key for s in self.supports],
            image=str(self.thumb.url) if self.thumb else None,
            banner=str(self.banner.url) if self.banner else None,
            art=str(self.art.url) if self.art else None,
            era=self.era,
        )


@daitaku
class Stories(Events[Story], metaclass=SingletonMeta):
    SOURCES = (STORY_INDEX_URL,)

    def search(self, query) -> list[Story]:
        return super().search(query)

    def _validate_item(self, item: Story) -> None:
        if not item.periods:
            logger.warning("Story %s has no periods", item.key)
        # A story's contents are its Event Support Cards (the welfare grant) — every
        # story grants at least one, so an empty list is a data-quality signal (the
        # welfare section didn't resolve), like the banner empty-contents check. The
        # trainee cast is a separate, always-present concern and is not contents.
        if not item.supports:
            logger.warning("Story %s has no resolvable support contents", item.key)

    def _enrichers(self):

        def _apply_en_overlay(story: Story) -> None:
            key = str(story.key)
            period = Static().story_period(key)
            name_override = Static().story_name_override(key)
            flags = Static().event_flags(key)
            if period is None and name_override is None and not flags:
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
            if flags:
                story.apply_flags(flags)
            story.references.add(store.source())

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

            # The welfare grant — distinct cards only. A card is listed once per copy
            # granted (completion + the roulette), but contents is the *set* of cards
            # the story grants, so dedupe on resolved key, preserving first-seen order.
            supports: list[Support] = []
            seen: set[StableKey] = set()
            for sup_slug in record.get("support_ids", []):
                s = supports_col.get(StableKey(f"{Support.KEY_PREFIX}{sup_slug}"))
                if s is None:
                    logger.warning("No support for slug %s in %s", sup_slug, gametora_key)
                    continue
                if s.key in seen:
                    continue
                seen.add(s.key)
                supports.append(s)

            # Story-link cast (Event-Point-Bonus top tier) — exact card keys, so a
            # direct lookup (vs the welfare/featured slug search above).
            link_trainees = [
                t for slug in record.get("link_trainee_ids", [])
                if (t := Trainees().get(StableKey(f"{Trainee.KEY_PREFIX}{slug}"))) is not None
            ]
            link_supports = [
                s for slug in record.get("link_support_ids", [])
                if (s := supports_col.get(StableKey(f"{Support.KEY_PREFIX}{slug}"))) is not None
            ]

            stories.append(
                Story(
                    key=stable_key,
                    periods=Periods([record["period"]]),
                    title=title,
                    art=art,
                    thumb=thumb,
                    trainees=trainees,
                    supports=supports,
                    link_trainees=link_trainees,
                    link_supports=link_supports,
                    references=references,
                    correlations={Sources.GAMETORA.value: gametora_n},
                    era=_era_for_ceiling(record.get("pt_ceiling")),
                )
            )

        self._assign_banners(stories)
        return stories

    def _assign_banners(self, stories: list[Story]) -> None:
        banner_records = Static().story_banners()
        if not banner_records:
            return

        # Match reference images to stories by ordinal (earliest first).
        ordered = sorted(
            (s for s in stories if s.periods),
            key=lambda s: min(p.start for p in s.periods),
        )
        outdir = Config().static / "img" / "stories"
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
        outdir = Config().static / "img" / "stories"
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
