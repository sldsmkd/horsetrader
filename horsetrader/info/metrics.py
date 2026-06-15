from contextlib import contextmanager
from time import perf_counter
from typing import Any, Iterator

from horsetrader.core import SingletonMeta
from horsetrader.semantics import spechan


@spechan
class Metrics(metaclass=SingletonMeta):
    """Single source of truth for a run's metrics — Spechan's quantitative log.

    The counterpart to ``Logger``: where the logger narrates *what happened*, this
    holds *how much / how many / how long*. A singleton so every character writes to
    and reads from one store, instead of each stashing its own tally on a classvar
    or an instance dict (the pattern this replaces — a no-EN ``set`` on the bake, a
    placement dict on the predictor, the orchestrator's own metrics dict).

    Three write verbs, namespaced by dotted key (``bake.no_en``, ``predict.banner``,
    ``load.banners``) so the store stays browsable:

    - ``incr(key)`` — a running counter.
    - ``track(key, item)`` — a *distinct* counter (deduped set; reads as its size).
      Used where the same thing is met repeatedly but should count once, e.g. one
      Japlish name encoded into many records.
    - ``set(key, value)`` — a gauge: a final value, dict, or timing. ``timing(key)``
      is the context-manager sugar over it.

    Read via ``count(key)`` (counter value or distinct size), ``get(key)`` (a gauge),
    or ``snapshot()`` (the whole store, nested one level by the dotted namespace —
    the shape ``Pipeline.metrics`` exposes and ``main.py`` pretty-prints).

    Lifetime: ``clear()`` empties it in place for a fresh run (identity preserved, so
    references held elsewhere keep pointing at the live store). ``SingletonMeta`` also
    gives ``Metrics.reset()`` to drop the instance entirely.
    """

    def __init__(self) -> None:
        self._counters: dict[str, int] = {}
        self._distinct: dict[str, set[str]] = {}
        self._gauges: dict[str, Any] = {}

    # ── write ────────────────────────────────────────────────────────────────

    def incr(self, key: str, by: int = 1) -> None:
        self._counters[key] = self._counters.get(key, 0) + by

    def track(self, key: str, item: str) -> None:
        self._distinct.setdefault(key, set()).add(item)

    def set(self, key: str, value: Any) -> None:
        self._gauges[key] = value

    @contextmanager
    def timing(self, key: str) -> Iterator[None]:
        start = perf_counter()
        try:
            yield
        finally:
            self.set(key, perf_counter() - start)

    # ── read ─────────────────────────────────────────────────────────────────

    def count(self, key: str) -> int:
        if key in self._distinct:
            return len(self._distinct[key])
        return self._counters.get(key, 0)

    def get(self, key: str) -> Any:
        return self._gauges.get(key)

    def snapshot(self) -> dict[str, Any]:
        """The whole store as a nested dict, keyed by the dotted namespace head.

        Distinct sets collapse to their size; counters and gauges pass through. A
        key with no dot lands at the top level; ``a.b`` nests under ``a``."""
        flat: dict[str, Any] = {
            **self._gauges,
            **self._counters,
            **{key: len(items) for key, items in self._distinct.items()},
        }
        out: dict[str, Any] = {}
        for key, value in flat.items():
            head, _, tail = key.partition(".")
            if tail:
                out.setdefault(head, {})[tail] = value
            else:
                out[head] = value
        return out

    def clear(self) -> None:
        self._counters.clear()
        self._distinct.clear()
        self._gauges.clear()
