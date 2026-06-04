from abc import abstractmethod
from dataclasses import dataclass, field

from horsetrader.semantics import tazuna

from .references import References
from .tracen_object import TracenObject


@tazuna
@dataclass
class TracenModel(TracenObject):
    """A `TracenObject` that participates in the referential graph.

    Adds what entities and events share beyond bare identity: `references` (the
    cross-reference graph), `correlations`, and a `match` search surface. Config
    objects are `TracenObject`s but not `TracenModel`s — they have a stable key
    yet none of this graph machinery (see `TracenObject` for the cut).

    `key` is inherited from `TracenObject`.
    """

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
