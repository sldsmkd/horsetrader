import json
from typing import Optional

from horsetrader.core import Config, JST

from horsetrader.models.core import TracenModel, TracenModels
from horsetrader.models.entities.entities import Entities
from horsetrader.models.events.banner import Banner
from horsetrader.models.events.events import Events
from horsetrader.semantics import eishin
from horsetrader.timeline import Timeline

from ._mappers import MAPPERS, map_event


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
    def events(timeline: Timeline) -> bool:
        """Write events.json from the EN Timeline produced by Predict.

        Output is a flat list ``{"events": [...]}`` sorted by the Timeline's
        tz start date (UTC). Each entry's ``start``, ``end``, and ``predicted``
        come from the matched Period, not the Banner dataclass field.
        """
        records = []
        for event in timeline:
            if not isinstance(event, Banner):
                continue
            period = next((p for p in event.periods if p.tzinfo == timeline.tz), None)
            if period is None:
                continue
            records.append(map_event(event, period))
        path = Config().site / "static" / "events.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"events": records}, ensure_ascii=False, indent=2))
        return True

    @staticmethod
    def timeline(models: list[TracenModels]) -> Timeline:
        """Build the base JST Timeline from all Events collections in the stage list."""
        tl = Timeline(JST)
        for collection in models:
            if isinstance(collection, Events):
                tl.extend(collection.values())
        return tl

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
