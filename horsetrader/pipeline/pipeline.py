from time import perf_counter
from typing import Any

from horsetrader.core import SingletonMeta
from horsetrader.info import Logger
from horsetrader.models import TracenModels
from horsetrader.models.config import load_gacha_config
from horsetrader.models.rewards import load_reward_maps, load_reward_structures
from horsetrader.output import Bake
from horsetrader.semantics import rudolf
from horsetrader.timeline import Predict

logger = Logger.get(__name__)


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
    collects events that already carry a UTC period (confirmed EN dates baked
    in at enrichment time) then passes them through ``Predict`` (future: LOESS
    regression for unscheduled events), and hands the result to ``Bake``.
    One-shot — a second call logs an error and exits.
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
        """Build timelines and write output. One-shot — calling twice is a programming bug."""
        if self._ran:
            logger.error("Pipeline.run() called more than once")
        self._ran = True
        self._ensure_loaded()
        stages = list(self._stages.values())
        jst_timeline = Bake.timeline(stages)
        predict = Predict()
        self._timeline = predict.predict(jst_timeline)
        self._metrics["_predict"] = predict.stats()
        # Reward structures + maps are curated config, not TracenModels stages, so
        # they don't ride the auto-discovery registry — load them here (upstream
        # of the bake) and hand them to Eishin.
        structures = load_reward_structures()
        maps = load_reward_maps()
        gacha = load_gacha_config()
        self._metrics["_config"] = {
            "reward_structures": len(structures),
            "reward_maps": len(maps),
            "gacha": 1,
        }
        return (
            Bake.academy(stages)
            and Bake.events(self._timeline)
            and Bake.config(structures, maps, gacha)
        )

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
