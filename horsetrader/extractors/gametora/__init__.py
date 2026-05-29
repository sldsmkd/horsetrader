from collections.abc import Sequence

from horsetrader.core import SingletonMeta
from horsetrader.semantics import transcend

from .banners import GametoraBanners
from .character import GametoraCharacter
from .characters import GametoraCharacters
from .items import GametoraItems
from .story import GametoraStories
from .support import GametoraSupport
from .supports import GametoraSupports
from .trainee import GametoraTrainee
from .trainees import GametoraTrainees


@transcend
class Gametora(metaclass=SingletonMeta):
    """Facade for Gametora.com data extraction.

    Returns raw record dicts; entity construction is Digitan's responsibility
    (see [[project-transcend-digitan-boundary]]).
    """

    def __init__(self):
        self._banners_scraper = GametoraBanners()
        self._characters_scraper = GametoraCharacters()
        self._character_scraper = GametoraCharacter()
        self._items_scraper = GametoraItems()
        self._stories_scraper = GametoraStories()
        self._supports_scraper = GametoraSupports()
        self._support_scraper = GametoraSupport()
        self._trainees_scraper = GametoraTrainees()
        self._trainee_scraper = GametoraTrainee()

    def banners(self) -> Sequence[dict]:
        """Fetch JP gacha banner history (support and trainee banners)."""
        return self._banners_scraper.banners()

    def items(self) -> Sequence[dict]:
        """Fetch item index (icons + JP/EN names) from the Gametora items page."""
        return self._items_scraper.items()

    def stories(self) -> Sequence[dict]:
        """Fetch Story event index."""
        return self._stories_scraper.stories()

    def character(self, char_id: str, slug: str) -> dict:
        """Fetch data for a single character detail page."""
        return self._character_scraper.character({"id": char_id, "slug": slug})

    def characters(self) -> Sequence[dict]:
        """Fetch list of all characters from index page (with detail enrichment)."""
        return self._characters_scraper.characters()

    def support(self, slug: str) -> dict:
        """Fetch data for a single support card detail page."""
        return self._support_scraper.support({"slug": slug})

    def supports(self) -> Sequence[dict]:
        """Fetch list of all support cards from index page (with detail enrichment)."""
        return self._supports_scraper.supports()

    def trainee(self, slug: str) -> dict:
        """Fetch data for a single trainee detail page."""
        return self._trainee_scraper.trainee({"slug": slug})

    def trainees(self) -> Sequence[dict]:
        """Fetch list of all trainees from character index (with detail enrichment)."""
        return self._trainees_scraper.trainees()
