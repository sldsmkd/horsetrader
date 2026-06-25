"""Derived news-corpus service over the raw Umapyoi news extractor.

`UmapyoiNews` is the source adapter: index JSON, leaf JSON, normal cache
machinery. `News` consumes the whole corpus and exposes a small queryable read
model that domain code can use for enrichment/correlation without learning the
freeform leaf shape.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime
from html.parser import HTMLParser
import re
from typing import Any

from horsetrader.core import SingletonMeta
from horsetrader.extractors.umapyoi import Umapyoi
from horsetrader.info import Logger
from horsetrader.semantics import robroy

logger = Logger.get(__name__)

_NEWS_LEAF_URL_PREFIX = "https://umapyoi.net/api/v1/news"

_CM_SELECTION_TITLE_NEEDLES = (
    "selection begins",
    "selection of participating leagues",
    "selecting leagues",
    "selecting a league",
    "start selecting",
)
_CM_HELD_TITLE_NEEDLES = (
    "racing event",
    "race event",
    'held "champions meeting',
)
# Match on the invariant JP title. The DeepL-projected EN wobbles across the
# corpus ("Legend Race" / "Legendary race" / "The Legends Race"), so the EN
# needles silently dropped every pre-2023-07 occurrence; the JP is stable.
# Preview ("開催決定" — holding decided) is a superset of held ("開催"), so test
# the preview marker first.
_LEGEND_RACE_JP_NEEDLE = "レジェンドレース"
_LEGEND_RACE_PREVIEW_JP_NEEDLE = "開催決定"
_LEGEND_RACE_HELD_JP_NEEDLE = "開催"
_ANNIVERSARY_CAMPAIGN_TITLE = re.compile(
    r"(?P<version>(?:\d+(?:\.5)?|Half))(?:st|nd|rd|th)?\s+Anniversary\s+Campaign\s+Vol\.?\s*(?P<part>\d+)",
    re.I,
)


@robroy
@dataclass(frozen=True)
class NewsArticle:
    """Compact, searchable projection of one Umapyoi news leaf."""

    announce_id: int
    label_name_en: str | None
    title: str | None
    title_english: str | None
    post_at: int | None
    article_image: str | None
    image: str | None
    message_image_urls: tuple[str, ...]
    raw: dict[str, Any]

    @property
    def post_at_datetime(self) -> datetime | None:
        if self.post_at is None:
            return None
        return datetime.fromtimestamp(self.post_at, tz=UTC)

    @property
    def post_at_iso(self) -> str | None:
        if self.post_at_datetime is None:
            return None
        return self.post_at_datetime.isoformat().replace("+00:00", "Z")

    @property
    def url(self) -> str:
        return f"{_NEWS_LEAF_URL_PREFIX}/{self.announce_id}"

    @property
    def banner_image_url(self) -> str | None:
        for candidate in (self.image, self.article_image):
            if candidate:
                return candidate
        return None

    @property
    def primary_image_url(self) -> str | None:
        return self.image_urls[0] if self.image_urls else None

    @property
    def image_urls(self) -> tuple[str, ...]:
        urls = []
        for candidate in (self.article_image, self.image, *self.message_image_urls):
            if candidate and candidate not in urls:
                urls.append(candidate)
        return tuple(urls)


@robroy
class News(metaclass=SingletonMeta):
    """Query service for the cached Umapyoi news corpus.

    This deliberately stops at a compact article index. It does not create
    events, decide source authority, or mutate models; callers own the domain
    interpretation of any match.
    """

    def __init__(self):
        self._umapyoi = Umapyoi()
        self._articles: list[NewsArticle] | None = None

    def articles(self) -> list[NewsArticle]:
        """Return all news articles in Umapyoi index order."""
        if self._articles is None:
            ids = self._article_ids()
            articles: list[NewsArticle] = []
            for news_id in ids:
                try:
                    payload = self._umapyoi.news_item(news_id)
                    articles.append(self._article(news_id, payload))
                except Exception as exc:
                    logger.warning(
                        "news %s: failed to load leaf payload: %s", news_id, exc
                    )
            self._articles = articles
        return list(self._articles)

    def search(
        self,
        text: str | None = None,
        *,
        label: str | None = None,
        english: bool = True,
        japanese: bool = True,
    ) -> list[NewsArticle]:
        """Search article titles by substring, optionally constrained by label."""
        needle = text.lower() if text is not None else None
        return [
            article for article in self.articles()
            if self._matches_label(article, label)
            and self._matches_text(article, needle, english=english, japanese=japanese)
        ]

    def between(
        self,
        start: datetime,
        end: datetime,
        *,
        label: str | None = None,
    ) -> list[NewsArticle]:
        """Articles whose `post_at` lies in the inclusive datetime window."""
        start_utc = self._as_utc(start)
        end_utc = self._as_utc(end)
        return [
            article for article in self.articles()
            if self._matches_label(article, label)
            and article.post_at_datetime is not None
            and start_utc <= article.post_at_datetime <= end_utc
        ]

    def league_of_heroes_team_building(self) -> list[NewsArticle]:
        """Known LoH pre-event signal: team-building period announcement rows."""
        return [
            article for article in self.search(
                "League of Heroes",
                label="Game",
                english=True,
                japanese=False,
            )
            if article.title_english is not None
            and "team building period begins" in article.title_english.lower()
        ]

    def legend_race(self, jp_start: datetime) -> NewsArticle | None:
        """Best banner article for one Legend Race occurrence."""
        ranked: list[tuple[float, NewsArticle]] = []
        for article in self.search(
            _LEGEND_RACE_JP_NEEDLE,
            label="Game",
            english=False,
            japanese=True,
        ):
            if article.post_at_datetime is None or article.banner_image_url is None:
                continue
            article_kind = self._legend_race_article_kind(article.title or "")
            if article_kind is None:
                continue

            hours = (
                self._as_utc(jp_start) - article.post_at_datetime
            ).total_seconds() / 3600
            if article_kind == "held" and -12 <= hours <= 24:
                score = abs(hours)
            elif article_kind == "preview" and 0 <= hours <= 72:
                score = 100 + abs(hours - 24)
            else:
                continue
            ranked.append((score, article))

        if not ranked:
            return None
        ranked.sort(key=lambda item: item[0])
        return ranked[0][1]

    def anniversary_campaign(
        self,
        anniversary_key: str,
        part: int,
        jp_start: datetime,
    ) -> NewsArticle | None:
        """Best banner article for one anniversary campaign mission part."""
        ranked: list[tuple[float, NewsArticle]] = []
        for article in self.search(
            "Anniversary Campaign",
            label="Game",
            english=True,
            japanese=False,
        ):
            title = article.title_english or ""
            parsed = self._anniversary_campaign_title(title)
            if parsed != (anniversary_key, part):
                continue
            if article.post_at_datetime is None or article.banner_image_url is None:
                continue

            hours = (
                self._as_utc(jp_start) - article.post_at_datetime
            ).total_seconds() / 3600
            if -12 <= hours <= 120:
                ranked.append((abs(hours), article))

        if not ranked:
            return None
        ranked.sort(key=lambda item: item[0])
        return ranked[0][1]

    def champions_meeting(self, name: str, jp_start: datetime) -> NewsArticle | None:
        """Best close-signal article for one Champions Meeting occurrence.

        The news archive has several CM article families. For event art/enrichment,
        prefer the pre-event league-selection article keyed by CM name/category and
        date proximity; fall back to same-day held articles. Earlier historical CMs
        legitimately have no article match.
        """
        normalized_name = self._normalize_cm_name(name)
        ranked: list[tuple[float, NewsArticle]] = []
        for article in self.search(
            label="Game",
            english=True,
            japanese=False,
        ):
            title = article.title_english or ""
            if self._cm_title_name(title) != normalized_name:
                continue
            if article.post_at_datetime is None:
                continue

            hours = (
                self._as_utc(jp_start) - article.post_at_datetime
            ).total_seconds() / 3600
            article_kind = self._cm_article_kind(title)
            if article_kind == "selection" and 0 <= hours <= 120:
                score = abs(hours - 72)
            elif article_kind == "held" and -24 <= hours <= 24:
                score = 100 + abs(hours)
            else:
                continue
            ranked.append((score, article))

        if not ranked:
            return None
        ranked.sort(key=lambda item: item[0])
        return ranked[0][1]

    def strongest_team(self, jp_start: datetime) -> NewsArticle | None:
        """Best custom-art article for one Dream Team occurrence.

        Older translated articles called it "Strongest Team"; the official EN
        release calls it "Dream Team". Preview/end articles exist under both
        names, but the event-specific oshi art lives on the underway/has-begun
        article at the event start.
        """
        articles = {
            article.announce_id: article
            for query in ("Dream Team", "Strongest Team")
            for article in self.search(
                query,
                label="Game",
                english=True,
                japanese=False,
            )
        }
        ranked: list[tuple[float, NewsArticle]] = []
        for article in articles.values():
            title = article.title_english or ""
            if article.post_at_datetime is None or article.banner_image_url is None:
                continue
            if not self._strongest_team_is_underway(title):
                continue

            hours = (
                self._as_utc(jp_start) - article.post_at_datetime
            ).total_seconds() / 3600
            if -12 <= hours <= 36:
                ranked.append((abs(hours), article))

        if not ranked:
            return None
        ranked.sort(key=lambda item: item[0])
        return ranked[0][1]

    def _article_ids(self) -> list[str]:
        payload = self._umapyoi.news()
        if not isinstance(payload, list):
            raise RuntimeError(
                f"Expected Umapyoi news index to be a list, got {type(payload).__name__}"
            )
        ids = []
        for item in payload:
            if isinstance(item, int):
                ids.append(str(item))
            elif isinstance(item, str) and item.strip():
                ids.append(item.strip())
            else:
                logger.warning("news index: skipping unsupported id %r", item)
        return ids

    @staticmethod
    def _article(news_id: str, payload: Any) -> NewsArticle:
        if not isinstance(payload, dict):
            raise RuntimeError(
                f"Expected Umapyoi news {news_id} to be a dict, got {type(payload).__name__}"
            )
        announce_id = payload.get("announce_id")
        if not isinstance(announce_id, int):
            announce_id = int(news_id)
        raw_post_at = payload.get("post_at")
        return NewsArticle(
            announce_id=announce_id,
            label_name_en=_str_or_none(payload.get("label_name_en")),
            title=_str_or_none(payload.get("title")),
            title_english=_str_or_none(payload.get("title_english")),
            post_at=raw_post_at if isinstance(raw_post_at, int) else None,
            article_image=_str_or_none(payload.get("article_image")),
            image=_str_or_none(payload.get("image")),
            message_image_urls=_message_image_urls(payload),
            raw=payload,
        )

    @staticmethod
    def _matches_label(article: NewsArticle, label: str | None) -> bool:
        return label is None or article.label_name_en == label

    @staticmethod
    def _matches_text(
        article: NewsArticle,
        needle: str | None,
        *,
        english: bool,
        japanese: bool,
    ) -> bool:
        if needle is None:
            return True
        haystacks: Iterable[str | None] = (
            (article.title_english if english else None),
            (article.title if japanese else None),
        )
        return any(
            haystack is not None and needle in haystack.lower()
            for haystack in haystacks
        )

    @staticmethod
    def _as_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    @staticmethod
    def _cm_article_kind(title: str) -> str | None:
        lowered = title.lower()
        if any(needle in lowered for needle in _CM_SELECTION_TITLE_NEEDLES):
            return "selection"
        if any(needle in lowered for needle in _CM_HELD_TITLE_NEEDLES):
            return "held"
        return None

    @staticmethod
    def _legend_race_article_kind(title: str) -> str | None:
        if _LEGEND_RACE_JP_NEEDLE not in title:
            return None
        if _LEGEND_RACE_PREVIEW_JP_NEEDLE in title:
            return "preview"
        if _LEGEND_RACE_HELD_JP_NEEDLE in title:
            return "held"
        return None

    @classmethod
    def _cm_title_name(cls, title: str) -> str | None:
        match = re.search(r"Champions Meeting\s+([^\"!]+)", title)
        if not match:
            match = re.search(r"Meeting of Champions\s+([^\"!]+)", title)
        if not match:
            return None
        return cls._normalize_cm_name(match.group(1))

    @staticmethod
    def _normalize_cm_name(name: str) -> str:
        out = name.strip().rstrip(",").upper()
        out = re.sub(r",?\s+A\s+RACING\s+EVENT.*$", "", out)
        out = re.sub(r"\s+RACE\s+EVENT.*$", "", out)
        out = re.sub(r"\s+RACING\s+EVENT.*$", "", out)
        if out == "VARGO CUP":
            return "VIRGO CUP"
        return out

    @staticmethod
    def _anniversary_campaign_title(title: str) -> tuple[str, int] | None:
        match = _ANNIVERSARY_CAMPAIGN_TITLE.search(title)
        if not match:
            return None
        version = match.group("version")
        if version.lower() == "half":
            normalized = "0_5"
        elif "." in version:
            normalized = version.replace(".", "_")
        else:
            normalized = f"{version}_0"
        return (f"anniversary-{normalized}", int(match.group("part")))

    @staticmethod
    def _strongest_team_is_underway(title: str) -> bool:
        lowered = title.lower()
        return (
            ("dream team" in lowered or "strongest team" in lowered)
            and ("underway" in lowered or "has begun" in lowered)
            and "ends" not in lowered
            and "over" not in lowered
        )


def _str_or_none(value: Any) -> str | None:
    return value if isinstance(value, str) else None


class _ImageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "img":
            return
        attr = dict(attrs)
        src = attr.get("src")
        if src:
            self.urls.append(src)


def _message_image_urls(payload: dict[str, Any]) -> tuple[str, ...]:
    urls = []
    parser = _ImageParser()
    for key in ("message_english", "message"):
        value = payload.get(key)
        if isinstance(value, str):
            parser.feed(value)
    for url in parser.urls:
        if url not in urls:
            urls.append(url)
    return tuple(urls)
