from collections.abc import Sequence

from horsetrader.core import SingletonMeta
from horsetrader.semantics import transcend

from .banners import GametoraBanners
from .champions_meetings import GametoraChampionsMeetings
from .character import GametoraCharacter
from .characters import GametoraCharacters
from .items import GametoraItems
from .legend_races import GametoraLegendRaces
from .missions import GametoraMissions
from .races import GametoraRaces
from .racetracks import GametoraRacetracks
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
        self._champions_meetings_scraper = GametoraChampionsMeetings()
        self._characters_scraper = GametoraCharacters()
        self._character_scraper = GametoraCharacter()
        self._items_scraper = GametoraItems()
        self._legend_races_scraper = GametoraLegendRaces()
        self._missions_scraper = GametoraMissions()
        self._races_scraper = GametoraRaces()
        self._racetracks_scraper = GametoraRacetracks()
        self._stories_scraper = GametoraStories()
        self._supports_scraper = GametoraSupports()
        self._support_scraper = GametoraSupport()
        self._trainees_scraper = GametoraTrainees()
        self._trainee_scraper = GametoraTrainee()

    def banners(self) -> Sequence[dict]:
        """Fetch JP gacha banner history (support and trainee banners)."""
        return self._banners_scraper.banners()

    def champions_meetings(self) -> Sequence[dict]:
        """Fetch Champions Meeting occurrences (JP period + EN name, keyed cm-NNN)."""
        return self._champions_meetings_scraper.champions_meetings()

    def items(self) -> Sequence[dict]:
        """Fetch item index (icons + JP/EN names) from the Gametora items page."""
        return self._items_scraper.items()

    def legend_races(self) -> Sequence[dict]:
        """Fetch Legend Race occurrences (JP period + ordered per-trainee legs +
        JP/EN race name, keyed legendrace-NNN)."""
        return self._legend_races_scraper.legend_races()

    def missions(self) -> Sequence[dict]:
        """Fetch the JP limited-mission catalogue (JP title + JST window + reward
        items), keyed mission-NNN by logo id, across all JP history years."""
        return self._missions_scraper.missions()

    def missions_en(self) -> Sequence[dict]:
        """Fetch the EN limited-mission overlay (EN title + UTC window), keyed by
        the shared mission-NNN logo id, across Global history years."""
        return self._missions_scraper.missions_en()

    def races(self) -> Sequence[dict]:
        """Fetch real race fixtures (JP/EN name + grade + surface + distance +
        racetrack + banner), keyed race-<banner-id>. Gamey calendar-less
        pseudo-races (Debut/Maiden/Exhibition) are filtered out."""
        return self._races_scraper.races()

    def racetracks(self) -> Sequence[dict]:
        """Fetch the racetrack index (icons + JP/EN names), keyed racetrack-<id>."""
        return self._racetracks_scraper.racetracks()

    def courses(self) -> Sequence[dict]:
        """Fetch course records (surface + distance + variant + diagram) from each
        racetrack detail page, keyed course-<id> with parent racetrack key."""
        return self._racetracks_scraper.courses()

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
