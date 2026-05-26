import json
from collections.abc import Sequence

from horsetrader.core import SingletonMeta
from horsetrader.enums import CacheTime
from horsetrader.info import Logger
from horsetrader.semantics import transcend
from horsetrader.transport import UmaClient

from .character import UmapyoiCharacter
from .characters import UmapyoiCharacters

logger = Logger.get(__name__)


@transcend
class Umapyoi(metaclass=SingletonMeta):
    """Facade for umapyoi.net data extraction.

    Returns raw record dicts; entity construction is Digitan's responsibility
    (see [[project-transcend-digitan-boundary]]).
    """

    def __init__(self):
        self._characters_scraper = UmapyoiCharacters()
        self._character_scraper = UmapyoiCharacter()
        # TODO: when Supports/Trainees are ported, move support_detail /
        # outfits_for_character / trainee_title_en into their own sub-scrapers
        # (umapyoi/supports.py, umapyoi/trainees.py) following the same pattern.
        self._uc = UmaClient()
        self._support_detail_cache: dict[int, dict] = {}
        self._outfit_cache: dict[int, list[dict]] = {}

    def character(self, key: str) -> dict:
        """Fetch one character by canonical key (Gametora slug or Umapyoi tag)."""
        return self._characters_scraper.character(key)

    def characters(self) -> Sequence[dict]:
        """Fetch all characters from the umapyoi list endpoint."""
        return self._characters_scraper.characters()
