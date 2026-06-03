from collections.abc import Sequence

from horsetrader.core import SingletonMeta
from horsetrader.semantics import transcend

from .events import WikiruEvents


@transcend
class Wikiru(metaclass=SingletonMeta):
    """Facade for umamusume.wikiru.jp data extraction.

    A **fallback** JP source alongside Gametora — it covers the event types
    Gametora has no structured surface for (Showtime, League of Heroes, Racing
    Carnival, ...). wikiru is hand-edited, so its scrapers are deliberately
    tolerant (warn-and-skip, not fail-loud). Returns raw record dicts; entity
    construction is Digitan's responsibility.
    """

    def __init__(self):
        self._events_scraper = WikiruEvents()

    def showtimes(self) -> Sequence[dict]:
        """Fetch Fuji Kiseki Showtime occurrences (JP period + name, keyed showtime-NNN)."""
        return self._events_scraper.showtimes()
