from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from horsetrader.core import StableKey
from horsetrader.semantics import tazuna

from .references import References


@tazuna
@dataclass
class TracenModel(ABC):
    key: StableKey
    correlations: dict[str, int] = field(default_factory=dict, kw_only=True)
    references: References = field(default_factory=References, kw_only=True)

    @abstractmethod
    def match(self, query: str) -> bool:
        """Return True if this model matches ``query``.

        Abstract by contract — every concrete model declares its own search
        surface explicitly, even if it adds nothing beyond the base case.
        The body here remains callable via ``super().match(query)`` and
        provides the case-insensitive substring on the stable key that most
        overrides start from.
        """
        return query.lower() in self.key.lower()
