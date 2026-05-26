import json

from horsetrader.core import Japlish, SingletonMeta
from horsetrader.enums import CacheTime
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)

_OUTFIT_LIST_URL_PREFIX = "https://umapyoi.net/api/v1/outfit/character"


@transcend
class UmapyoiTrainees(metaclass=SingletonMeta):
    """Outfit-list scraper for umapyoi.net trainee titles.

    Owns the per-character outfit endpoint and resolves the EN title for a
    given trainee_id. Returns raw record dicts; entity construction is
    Digitan's responsibility.
    """

    def __init__(self):
        self._uc = UmaClient()
        self._outfit_cache: dict[int, list[dict]] = {}

    def _outfits(self, gametora_id: int) -> list[dict]:
        cached = self._outfit_cache.get(gametora_id)
        if cached is not None:
            return list(cached)

        url = f"{_OUTFIT_LIST_URL_PREFIX}/{gametora_id}"
        response = self._uc.get(url, cache=CacheTime.INDEX)
        if isinstance(response, bytes):
            raise RuntimeError(f"Expected text response from {url}, got bytes")

        payload = json.loads(response)
        if not isinstance(payload, list):
            raise RuntimeError(
                f"Expected list response from {url}, got {type(payload).__name__}"
            )

        self._outfit_cache[gametora_id] = payload
        return list(payload)

    def trainee(self, trainee_id: int, gametora_id: int) -> dict:
        """Fetch the umapyoi outfit record for a specific trainee.

        Returns a raw record dict (no Trainee construction — that's Digitan's
        job). `title` is a `Japlish` when an EN outfit title is available;
        otherwise the dict carries an empty `title` slot.
        """
        if trainee_id <= 0 or gametora_id <= 0:
            raise ValueError("trainee_id and gametora_id must be positive integers")

        url = f"{_OUTFIT_LIST_URL_PREFIX}/{gametora_id}"
        outfits = self._outfits(gametora_id)

        title: Japlish | None = None
        for outfit in outfits:
            outfit_id = outfit.get("id")
            try:
                if int(outfit_id) != trainee_id:
                    continue
            except (TypeError, ValueError):
                continue
            title_en = outfit.get("title_en")
            if isinstance(title_en, str) and title_en.strip():
                title = Japlish(title_en.strip())
            break

        logger.info(
            f"Fetched umapyoi outfit for trainee_id={trainee_id} gametora_id={gametora_id}"
        )

        return {
            "title": title,
            "references": [url],
        }
