import json
from typing import Optional

from horsetrader.core import Config

from horsetrader.models.core import TracenModel, TracenModels
from horsetrader.models.entities.entities import Entities
from horsetrader.models.events.events import Events
from horsetrader.semantics import eishin

from ._mappers import MAPPERS


@eishin
class Bake:
    @staticmethod
    def _bake(
        models: list[TracenModels],
        filename: str,
        sortkey: Optional[str] = None,
    ) -> bool:
        output = {
            type(collection).__name__.lower(): Bake._collect(collection, sortkey)
            for collection in models
        }
        path = Config().site / "static" / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(output, ensure_ascii=False, indent=2))
        return True

    @staticmethod
    def academy(models: list[TracenModels]) -> bool:
        """The orchestrator just gives us the world, we decide what needs baking and how to bake it."""
        return Bake._bake(
            [m for m in models if isinstance(m, Entities)], "academy.json"
        )

    @staticmethod
    def events(models: list[TracenModels]) -> bool:
        return Bake._bake(
            [m for m in models if isinstance(m, Events)],
            "events.json",
            sortkey="start",
        )

    @staticmethod
    def _collect(collection: TracenModels, sortkey: Optional[str]) -> dict:
        serialized = {key: Bake._serialize(model) for key, model in collection.items()}
        if sortkey is None:
            return dict(sorted(serialized.items()))
        return dict(
            sorted(serialized.items(), key=lambda item: item[1].get(sortkey, ""))
        )

    @staticmethod
    def _serialize(model: TracenModel) -> dict:
        mapper = MAPPERS.get(type(model))
        if mapper is None:
            raise TypeError(f"No mapper for {type(model).__name__}")
        return mapper(model)
