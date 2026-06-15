from datetime import timedelta
from ethicrawl import Ethicrawl, HttpClient, Config as EthicrawlConfig, Url, Resource

from horsetrader.core import Config, SingletonMeta
from horsetrader.enums import CacheTime
from horsetrader.info import Metrics
from horsetrader.semantics import shakur

from .uma_client_cache import UmaClientCache


class HttpError(RuntimeError):
    """Transport-layer HTTP failure carrying the response status code.

    Subclass of RuntimeError so existing callers that just propagate transport
    errors keep working; callers that need to distinguish (e.g. treat 404 as
    "missing" rather than "error") read `status_code`.
    """

    def __init__(self, message: str, status_code: int) -> None:
        super().__init__(message)
        self.status_code = status_code


@shakur
class UmaClient(metaclass=SingletonMeta):
    def __init__(self):
        self._ec = Ethicrawl()
        EthicrawlConfig().http.user_agent = (
            "HorseTrader/0.1 (+https://horsetrader.site/) Ethicrawl/1.0b"
        )
        self._http_client = HttpClient()
        self._chrome_client: HttpClient | None = None
        self._bound_domains: dict[str, HttpClient] = {}

    @staticmethod
    def _is_stale_chrome_session_error(exc: Exception) -> bool:
        message = str(exc).lower()
        return (
            "invalid session id" in message
            or "not connected to devtools" in message
            or "session deleted as the browser has closed" in message
        )

    def get(
        self,
        resource: str | Url | Resource,
        chrome: bool = False,
        cache: CacheTime | timedelta | None = None,
    ) -> str | bytes:
        if isinstance(resource, str):
            resource = Url(resource)
        if isinstance(resource, Url):
            resource = Resource(resource)
        if not isinstance(resource, Resource):
            raise TypeError(
                f"resource must be a str, Url, or Resource, got {type(resource)}"
            )
        _is_binary = UmaClientCache.is_binary(resource.url)
        if isinstance(cache, CacheTime):
            _cache_ttl = cache.value
        elif cache is not None:
            _cache_ttl = cache
        else:
            _cache_ttl = CacheTime.BINARY.value if _is_binary else CacheTime.INDEX.value
        _skip_refresh = Config().skip_cache_refresh
        _cached = UmaClientCache.read(
            resource.url, max_age=None if _skip_refresh else _cache_ttl
        )
        if _cached is not None:
            Metrics().incr("shakur.cache.hit")
            # No header on a cache hit — content_label infers from the file on disk.
            Metrics().incr(f"shakur.content_type.{UmaClientCache.content_label(resource.url)}")
            return _cached
        Metrics().incr("shakur.cache.miss")

        if _is_binary or not chrome:
            _client = self._http_client
        else:
            if self._chrome_client is None:
                self._chrome_client = HttpClient().with_chrome(headless=False)
            _client = self._chrome_client

        _domain = (
            resource.url.hostname
            if resource.url.scheme in ("http", "https")
            else str(resource.url)
        )
        if self._bound_domains.get(_domain) is not _client:
            self._ec.bind(resource.url, client=_client)
            self._bound_domains[_domain] = _client

        Metrics().incr("shakur.requests")
        try:
            response = _client.get(resource)
        except Exception as exc:
            if _client is self._chrome_client and self._is_stale_chrome_session_error(
                exc
            ):
                # Chrome session can expire if the browser process is closed — a
                # fresh session and one more wire call, not a failed fetch.
                self._chrome_client = HttpClient().with_chrome(headless=False)
                _client = self._chrome_client
                self._ec.bind(resource.url, client=_client)
                self._bound_domains[_domain] = _client
                Metrics().incr("shakur.requests")
                response = _client.get(resource)
            else:
                Metrics().incr("shakur.errors")
                raise

        if response.status_code != 200:
            # Every non-200 counts here; `try_get` reclassifies 404 as "missing" a
            # layer up, but at the wire it was still a failed fetch.
            Metrics().incr("shakur.errors")
            raise HttpError(
                f"Failed to fetch {resource.url}: {response.status_code}",
                status_code=response.status_code,
            )

        _headers = response.headers or {}
        _content_type = _headers.get("content-type")
        _is_binary_response = UmaClientCache.is_binary(
            resource.url, mime_type=_content_type
        )

        UmaClientCache.write(resource.url, response.content, mime_type=_content_type)
        # Prefer the response header; content_label falls back to the just-written
        # file on disk if the server sent no Content-Type.
        Metrics().incr(
            f"shakur.content_type.{UmaClientCache.content_label(resource.url, _content_type)}"
        )
        return response.content if _is_binary_response else response.text

    def try_get(
        self,
        resource: str | Url | Resource,
        cache: CacheTime | timedelta | None = None,
    ) -> str | bytes | None:
        """Like `get`, but treats 404 as "missing" rather than an error.

        Returns `None` if the resource is unavailable (either previously sentineled
        or returns 404 on this attempt). The sentinel short-circuits future calls
        until `CacheTime.SENTINEL` elapses, so we don't keep re-hitting URLs that
        don't exist. Other non-200 statuses still raise `HttpError`.
        """
        if isinstance(resource, str):
            resource = Url(resource)
        if isinstance(resource, Url):
            resource = Resource(resource)
        if not isinstance(resource, Resource):
            raise TypeError(
                f"resource must be a str, Url, or Resource, got {type(resource)}"
            )

        if UmaClientCache.is_sentinel(resource.url, max_age=CacheTime.SENTINEL.value):
            return None

        try:
            return self.get(resource, cache=cache)
        except HttpError as exc:
            if exc.status_code == 404:
                UmaClientCache.write_sentinel(resource.url)
                return None
            raise

    def flush(self, resource: str | Url | Resource) -> bool:
        if isinstance(resource, str):
            resource = Url(resource)
        if isinstance(resource, Url):
            resource = Resource(resource)
        if not isinstance(resource, Resource):
            raise TypeError(
                f"resource must be a str, Url, or Resource, got {type(resource)}"
            )
        return UmaClientCache.flush(resource.url)
