from typing import TypeVar

from horsetrader.models.core import TracenModel, TracenModels
from horsetrader.semantics import digitan

TEntity = TypeVar("TEntity", bound=TracenModel)


@digitan
class Entities(TracenModels[TEntity]):
    """Semantic wrapper around `TracenModels`, claimed by Digitan.

    DO NOT ADD CODE HERE. This class exists only to give entity-collection
    classes a name in the conventional `models/entities/` namespace that
    matches the `Entity` model wrapper. All shared collection behavior
    (caching, key indexing, fetch orchestration) belongs in `TracenModels`;
    per-collection behavior belongs in concrete subclasses like `Characters`.

    The `@digitan` marker is also a tripwire: everything that
    subclasses `Entities` should plausibly be Digitan's (who/what — characters,
    supports, trainees). If something non-Digitan starts wanting to live here,
    the mismatch with the marker is the signal to push back.
    """

    pass
