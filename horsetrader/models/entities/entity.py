from horsetrader.models.core import TracenModel
from horsetrader.semantics import digitan


@digitan
class Entity(TracenModel):
    """Semantic wrapper around `TracenModel`, claimed by Digitan.

    DO NOT ADD CODE HERE. This class exists only to give entity dataclasses
    a name in the conventional `models/entities/` namespace that matches the
    `Entities` collection wrapper. All shared model behavior belongs in
    `TracenModel`; per-entity behavior belongs in concrete subclasses like
    `Character`.

    The `@digitan` marker is also a tripwire: everything that
    subclasses `Entity` should plausibly be Digitan's (who/what — characters,
    supports, trainees). If something non-Digitan starts wanting to live here,
    the mismatch with the marker is the signal to push back.
    """

    pass
