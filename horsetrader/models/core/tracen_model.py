from dataclasses import dataclass, field

from horsetrader.core import StableKey
from horsetrader.semantics import tazuna

from .references import References


@tazuna
@dataclass
class TracenModel:
    key: StableKey
    correlations: dict[str, int] = field(default_factory=dict, kw_only=True)
    references: References = field(default_factory=References, kw_only=True)
