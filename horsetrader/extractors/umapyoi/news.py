import json
from typing import Any

from horsetrader.core import SingletonMeta
from horsetrader.enums import CacheTime
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

from ._cache import unix_json_cache_time

logger = Logger.get(__name__)

_NEWS_INDEX_URL = "https://umapyoi.net/api/v1/news"
_NEWS_LEAF_URL_PREFIX = "https://umapyoi.net/api/v1/news"


@transcend
class UmapyoiNews(metaclass=SingletonMeta):
    """Raw JSON cache surface for umapyoi.net news.

    The news API is deliberately kept freeform for now: callers get the decoded
    JSON payload exactly as the endpoint served it. Once scripts have observed
    enough real payloads, a stricter overlay extractor can sit on top of this.
    """

    def __init__(self):
        self._uc = UmaClient()
        self._index_cache: Any | None = None
        self._leaf_cache: dict[str, Any] = {}

    @staticmethod
    def _json(response: str | bytes, url: str) -> Any:
        if isinstance(response, bytes):
            raise RuntimeError(f"Expected text response from {url}, got bytes")
        return json.loads(response)

    @staticmethod
    def _normalize_id(news_id: str | int) -> str:
        normalized = str(news_id).strip()
        if not normalized:
            raise ValueError("news_id cannot be empty")
        return normalized

    def news(self) -> Any:
        """Fetch the raw news index JSON from /api/v1/news."""
        if self._index_cache is None:
            response = self._uc.get(_NEWS_INDEX_URL, cache=CacheTime.INDEX)
            self._index_cache = self._json(response, _NEWS_INDEX_URL)
            logger.info("Fetched news index from umapyoi")
        return self._index_cache

    def news_item(self, news_id: str | int) -> Any:
        """Fetch one raw news detail JSON from /api/v1/news/{id}."""
        normalized_id = self._normalize_id(news_id)
        cached = self._leaf_cache.get(normalized_id)
        if cached is not None:
            return cached

        url = f"{_NEWS_LEAF_URL_PREFIX}/{normalized_id}"
        response = self._uc.get(
            url,
            cache=lambda content, cached_at: unix_json_cache_time(
                content,
                cached_at,
                ("update_at", "post_at"),
            ),
        )
        payload = self._json(response, url)
        self._leaf_cache[normalized_id] = payload
        logger.info("Fetched news item from umapyoi: %s", normalized_id)
        return payload
