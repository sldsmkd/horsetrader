from collections.abc import Sequence

from horsetrader.core import SingletonMeta
from horsetrader.semantics import transcend

from .character import UmapyoiCharacter
from .characters import UmapyoiCharacters
from .trainees import UmapyoiTrainees


@transcend
class Umapyoi(metaclass=SingletonMeta):
    """Facade for umapyoi.net data extraction.

    Returns raw record dicts; entity construction is Digitan's responsibility
    (see [[project-transcend-digitan-boundary]]).
    """

    def __init__(self):
        self._characters_scraper = UmapyoiCharacters()
        self._character_scraper = UmapyoiCharacter()
        self._trainees_scraper = UmapyoiTrainees()

    def character(self, key: str) -> dict:
        """Fetch one character by canonical key (Gametora slug or Umapyoi tag)."""
        return self._characters_scraper.character(key)

    def characters(self) -> Sequence[dict]:
        """Fetch all characters from the umapyoi list endpoint."""
        return self._characters_scraper.characters()

    def trainee(self, trainee_id: int, gametora_id: int) -> dict:
        """Fetch the outfit record for one trainee by (trainee_id, gametora_id)."""
        return self._trainees_scraper.trainee(trainee_id, gametora_id)
