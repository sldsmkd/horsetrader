from abc import ABC
from dataclasses import dataclass

from horsetrader.core import StableKey
from horsetrader.semantics import eishin


@eishin
@dataclass
class TracenObject(ABC):
    """The apex of the model tree: anything that crosses the wire.

    Owned by Eishin — not by a domain character — because its single meaning is
    *"this gets baked."* The bundle is nothing but `stable-key → record` maps, so
    identity in the shared key vocabulary is the **universal** property of a baked
    thing, not a graph property. Hence the only field here is `key`.

    The cut this draws: cross-referencing and search (`references`,
    `correlations`, `match`) live one level down on `TracenModel` — the graph the
    entity/event collections need. Freestanding config (a `RewardStructure`) is a
    `TracenObject` with a stable key but no graph: it has *identity* without
    *participation in the references graph*.

    Ownership flips at this apex: the leaves are owned by their producers
    (`@digitan` / `@daitaku` / `@yayoi`), the root by the consumer (`@eishin`),
    because the one fact true of every node is "it gets serialised."
    """

    key: StableKey
