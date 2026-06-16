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
from typing import Any

from horsetrader.core import SingletonMeta
from horsetrader.extractors.umapyoi import Umapyoi
from horsetrader.info import Logger
from horsetrader.semantics import robroy

logger = Logger.get(__name__)

_NEWS_LEAF_URL_PREFIX = "https://umapyoi.net/api/v1/news"


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
