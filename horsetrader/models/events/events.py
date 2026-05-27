from typing import TypeVar

from horsetrader.models.core import TracenModel, TracenModels
from horsetrader.semantics import daitaku

TEvent = TypeVar("TEvent", bound=TracenModel)


@daitaku
class Events(TracenModels[TEvent]):
    """Semantic wrapper around `TracenModels` for event collections, claimed by Daitaku.

    DO NOT ADD CODE HERE. This class exists only to give event-collection
    classes a name in the conventional `models/events/` namespace that matches
    the `Event` model wrapper. All shared collection behavior (caching, key
    indexing, fetch orchestration) belongs in `TracenModels`; per-collection
    behavior belongs in concrete subclasses.
    """

    pass
