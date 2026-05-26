from dataclasses import dataclass

from horsetrader.core import SingletonMeta, StableKey
from horsetrader.semantics import digitan

from .character import Character, Characters
from .entities import Entities
from .entity import Entity


@digitan
@dataclass
class Support(Entity):
    character: Character

    def match(self, query: str) -> bool:
        return super().match(query) or self.character.match(query)


@digitan
class Supports(Entities[Support], metaclass=SingletonMeta):
    """Stub Supports collection — exercises the Characters dependency for
    pipeline shape testing. No scraping; synthesises one Support per Character.
    """

    SOURCES = ()

    def _fetch_primary(self) -> list[Support]:
        return [
            Support(key=StableKey(f"support-{c.key}"), character=c)
            for c in Characters().values()
        ]

    def _validate_item(self, item: Support) -> None:
        return
