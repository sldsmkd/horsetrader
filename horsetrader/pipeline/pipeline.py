from time import perf_counter
from typing import Any

from horsetrader.core import SingletonMeta
from horsetrader.models import TracenModels
from horsetrader.semantics import rudolf


@rudolf
class Pipeline(metaclass=SingletonMeta):
    """Top-level ETL orchestrator (singleton, lazy-loading, observer-only).

    Rudolf issues the dictat — "everyone, get ready for inspection" — and
    each ``TracenModels`` collection self-organises its loading via the
    singleton-driven dependency graph. Pipeline doesn't dictate order; it
    iterates the auto-discovered registry and pulls ``stats()`` from each.

    Lazy: ``__init__`` is empty setup. First read of ``metrics`` or
    ``stage()`` flips ``_loaded`` (before iterating) so any reentry into
    ``Pipeline()`` sees the in-flight singleton.
    """

    def __init__(self) -> None:
        self._metrics: dict[str, dict[str, Any]] = {}
        self._stages: dict[str, TracenModels] = {}
        self._loaded = False

    def stage(self, key: str) -> TracenModels:
        """Look up a loaded collection by stage name. Triggers load if needed."""
        self._ensure_loaded()
        return self._stages[key]

    @property
    def metrics(self) -> dict[str, dict[str, Any]]:
        """Pipeline-execution metrics. Triggers load if needed."""
        self._ensure_loaded()
        return self._metrics

    def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        self._loaded = True
        run_start = perf_counter()
        for cls in TracenModels._registry:
            instance = cls()
            name = cls.__name__.lower()
            self._stages[name] = instance
            self._metrics[name] = instance.stats()
        self._metrics["_run"] = {"elapsed_s": perf_counter() - run_start}
