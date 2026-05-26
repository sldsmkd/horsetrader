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

    def match(self, query: str) -> bool:
        """Return True if this model matches ``query``.

        Base case: case-insensitive substring on the stable key. Subclasses
        extend by checking additional searchable fields and falling back to
        ``super().match(query)`` for the key path.
        """
        return query.lower() in self.key.lower()
