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

    def occurrences(self, heading: str, key_prefix: str) -> Sequence[dict]:
        """Fetch a section's occurrences (JP period + name, keyed ``<key_prefix>-NNN``).

        Generic over the wikiru event-index sections — the caller supplies the
        heading text and key prefix (e.g. ``"トレーナー技能試験", "skilltest"``).
        """
        return self._events_scraper.occurrences(heading, key_prefix)
