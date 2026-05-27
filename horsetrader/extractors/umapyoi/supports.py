import json

from horsetrader.core import SingletonMeta
from horsetrader.enums import CacheTime
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)

_SUPPORT_BASE_URL = "https://umapyoi.net/api/v1/support"


@transcend
class UmapyoiSupports(metaclass=SingletonMeta):
    """Per-card support scraper for umapyoi.net.

    Fetches each support card individually and caches in memory. Returns raw
    record dicts; entity construction is Digitan's responsibility.
    """

    def __init__(self):
        self._uc = UmaClient()
        self._cache: dict[int, dict] = {}

    def support(self, support_id: int) -> dict:
        """Return enrichment dict for one support card.

        Keys: ``rarity_string`` (str | None), ``references``.
        """
        cached = self._cache.get(support_id)
        if cached is not None:
            return cached

        url = f"{_SUPPORT_BASE_URL}/{support_id}"
        response = self._uc.try_get(url, cache=CacheTime.LEAF)
        if response is None:
            result: dict = {"rarity_string": None, "references": []}
            self._cache[support_id] = result
            return result

        if isinstance(response, bytes):
            raise RuntimeError(f"Expected text response from {url}, got bytes")

        payload = json.loads(response)
        raw = payload.get("rarity_string")
        rarity_string = raw.strip() if isinstance(raw, str) and raw.strip() else None
        result = {
            "rarity_string": rarity_string,
            "references": [url],
        }
        self._cache[support_id] = result
        return result
