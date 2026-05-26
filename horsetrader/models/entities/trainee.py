from dataclasses import dataclass

from horsetrader.core import SingletonMeta, StableKey
from horsetrader.semantics import digitan

from .character import Character, Characters
from .entities import Entities
from .entity import Entity


@digitan
@dataclass
class Trainee(Entity):
    character: Character


@digitan
class Trainees(Entities[Trainee, Trainee, Trainee], metaclass=SingletonMeta):
    """Stub Trainees collection — exercises the Characters dependency for
    pipeline shape testing. No scraping; synthesises one Trainee per Character.
    """

    SOURCES = ()

    def trainees(self) -> list[Trainee]:
        return self.all()

    def trainee(self, key: str) -> Trainee | None:
        return self.get(key)

    def _fetch_primary(self) -> list[Trainee]:
        characters = Characters().characters()
        return [
            Trainee(key=StableKey(f"trainee-{c.key}"), character=c)
            for c in characters
        ]

    def _enrich_one(self, primary_item: Trainee) -> Trainee:
        return primary_item

    def _merge_one(self, primary_item: Trainee, secondary_item: Trainee) -> Trainee:
        return primary_item

    def _validate_item(self, item: Trainee) -> None:
        return
