"""Horsetrader data models.

Importing this package brings the core types into scope and triggers
class-definition of every concrete `TracenModels` collection in
`entities/` and `events/`. Each collection auto-registers via
`TracenModels.__init_subclass__` at definition time — that registration
is the contract of how a model becomes discoverable to `Pipeline`.

If you add a new collection, exporting it from this `__init__`
is what makes it part of the discoverable set.
"""

from .core import References, TracenModel, TracenModels
from .entities import (
    Character,
    Characters,
    Entities,
    Entity,
    Support,
    Supports,
    ThreeSizes,
    Trainee,
    Trainees,
)
from .events import (
    Banner,
    Banners,
    Event,
    Events,
)

__all__ = [
    # Core
    "References",
    "TracenModel",
    "TracenModels",
    # Entity wrappers
    "Entities",
    "Entity",
    # Characters
    "Character",
    "Characters",
    "ThreeSizes",
    # Supports
    "Support",
    "Supports",
    # Trainees
    "Trainee",
    "Trainees",
    # Event wrappers
    "Event",
    "Events",
    # Banners
    "Banner",
    "Banners",
]
