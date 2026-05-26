import json

from horsetrader.core import Japlish, SingletonMeta
from horsetrader.enums import CacheTime, Sources
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

logger = Logger.get(__name__)


@transcend
class UmapyoiCharacter(metaclass=SingletonMeta):
    """Fetcher for individual character data from umapyoi API."""

    def __init__(self):
        self._uc = UmaClient()

    def character(self, char_id: str) -> dict:
        """Fetch detail JSON for one character by game_id.

        Returns a raw record dict (no Character construction — that's Digitan's
        job). `three_sizes` is returned as a plain dict since Transcend doesn't
        need to know the project's typed `ThreeSizes` class.
        """
        url = f"https://umapyoi.net/api/v1/character/{char_id}"
        response = self._uc.get(url, cache=CacheTime.LEAF)
        if isinstance(response, bytes):
            raise RuntimeError(f"Expected text response from {url}, got bytes")

        data = json.loads(response)
        logger.info(f"Fetched character data from umapyoi for game_id={char_id}")

        profile_text = (data.get("profile") or "").replace("\\n", " ").strip()

        name_jp = data.get("name_jp", "")
        name_en = data.get("name_en", "")
        if name_jp:
            name = Japlish(name_jp)
            if name_en:
                name.en = name_en
        else:
            name = Japlish("")

        quote = Japlish(profile_text) if profile_text else None

        portrait_url = data.get("sns_icon") or data.get("thumb_img")

        correlations: dict[str, int] = {}
        game_id = data.get("game_id")
        if str(game_id).isdigit():
            correlations[Sources.UMAPYOI.value] = int(game_id)

        return {
            "name": name,
            "three_sizes": {
                "bust": data.get("size_b", 0),
                "waist": data.get("size_w", 0),
                "hips": data.get("size_h", 0),
            },
            "quote": quote,
            "portrait_url": portrait_url,
            "correlations": correlations,
            "references": [url],
        }
