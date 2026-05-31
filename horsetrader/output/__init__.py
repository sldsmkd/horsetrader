"""Eishin's output layer.

`Bake` is exposed lazily (PEP 562): the model `bake()` methods import their wire
records from `output._records`, which would otherwise pull `output/__init__` →
`bake` → `timeline` → `predictors` → back into the half-initialised
`models.events`, a cycle. Deferring the `bake` import until `Bake` is actually
accessed keeps `output._records` a clean leaf that models can import freely.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .bake import Bake

__all__ = ["Bake"]


def __getattr__(name: str):
    if name == "Bake":
        from .bake import Bake

        return Bake
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
