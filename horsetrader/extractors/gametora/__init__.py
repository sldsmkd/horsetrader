from collections.abc import Sequence

from horsetrader.core import SingletonMeta
from horsetrader.semantics import transcend

from .character import GametoraCharacter
from .characters import GametoraCharacters


@transcend
class Gametora(metaclass=SingletonMeta):
    """Facade for Gametora.com character data extraction.

    Returns raw record dicts; entity construction is Digitan's responsibility
    (see [[project-transcend-digitan-boundary]]).
    """

    def __init__(self):
        self._characters_scraper = GametoraCharacters()
        self._character_scraper = GametoraCharacter()

    def character(self, char_id: str, slug: str) -> dict:
        """Fetch data for a single character detail page."""
        return self._character_scraper.character({"id": char_id, "slug": slug})

    def characters(self) -> Sequence[dict]:
        """Fetch list of all characters from index page (with detail enrichment)."""
        return self._characters_scraper.characters()
