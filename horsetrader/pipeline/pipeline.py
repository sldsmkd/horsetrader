from time import perf_counter
from typing import Any

from horsetrader.core import SingletonMeta
from horsetrader.models import TracenModels
from horsetrader.output import Bake
from horsetrader.semantics import rudolf
from horsetrader.timeline import Concrete, Predict, Timeline


@rudolf
class Pipeline(metaclass=SingletonMeta):
    """Top-level ETL orchestrator (singleton, lazy-loading).

    Rudolf issues the dictat — "everyone, get ready for inspection" — and
    each ``TracenModels`` collection self-organises its loading via the
    singleton-driven dependency graph. Pipeline doesn't dictate load order;
    it iterates the auto-discovered registry and pulls ``stats()`` from each.

    Lazy: ``__init__`` is empty setup. First read of ``metrics`` or
    ``stage()`` flips ``_loaded`` so any reentry into ``Pipeline()`` sees
    the in-flight singleton.

    ``run()`` is the write step: builds the JST Timeline from loaded stages,
    projects it through ``Concrete`` (confirmed EN dates) then ``Predict``
    (future: LOESS regression for unscheduled events), and hands the result
    to ``Bake``. One-shot — subsequent calls return ``False`` immediately.
    """

    def __init__(self) -> None:
        self._metrics: dict[str, dict[str, Any]] = {}
        self._stages: dict[str, TracenModels] = {}
        self._timeline: Timeline | None = None
        self._loaded = False
        self._ran = False

    def stage(self, key: str) -> TracenModels:
        """Look up a loaded collection by stage name. Triggers load if needed."""
        self._ensure_loaded()
        return self._stages[key]

    @property
    def metrics(self) -> dict[str, dict[str, Any]]:
        """Pipeline-execution metrics. Triggers load if needed."""
        self._ensure_loaded()
        return self._metrics

    @property
    def timeline(self) -> Timeline | None:
        return self._timeline

    def run(self) -> bool:
        """Build timelines and write output. No-op if already run; returns False on repeat call."""
        if self._ran:
            return False
        self._ran = True
        self._ensure_loaded()
        stages = list(self._stages.values())
        jst_timeline = Bake.timeline(stages)
        utc_timeline = Concrete().project(jst_timeline)
        self._timeline = Predict().predict(jst_timeline, utc_timeline)
        return Bake.academy(stages) and Bake.events(self._timeline)

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
