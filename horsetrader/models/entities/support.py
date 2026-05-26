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


@digitan
class Supports(Entities[Support, Support, Support], metaclass=SingletonMeta):
    """Stub Supports collection — exercises the Characters dependency for
    pipeline shape testing. No scraping; synthesises one Support per Character.
    """

    SOURCES = ()

    def supports(self) -> list[Support]:
        return self.all()

    def support(self, key: str) -> Support | None:
        return self.get(key)

    def _fetch_primary(self) -> list[Support]:
        characters = Characters().characters()
        return [
            Support(key=StableKey(f"support-{c.key}"), character=c)
            for c in characters
        ]

    def _enrich_one(self, primary_item: Support) -> Support:
        return primary_item

    def _merge_one(self, primary_item: Support, secondary_item: Support) -> Support:
        return primary_item

    def _validate_item(self, item: Support) -> None:
        return
