from time import perf_counter
from typing import Any

from horsetrader.core import SingletonMeta
from horsetrader.info import Logger, Metrics
from horsetrader.models import TracenModels
from horsetrader.models.config import load_gacha_config
from horsetrader.models.rewards import load_reward_maps, load_reward_structures
from horsetrader.output import Bake
from horsetrader.semantics import rudolf
from horsetrader.timeline import Predict, Timeline

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
        self._stages: dict[str, TracenModels] = {}
        self._timeline: Timeline | None = None
        self._loaded = False
        self._ran = False

    def stage(self, key: str) -> TracenModels:
        """Look up a loaded collection by stage name. Triggers load if needed."""
        self._ensure_loaded()
        return self._stages[key]

    @property
    def metrics(self) -> dict[str, Any]:
        """Pipeline-execution metrics. Triggers load if needed.

        The store is Spechan's singleton ``Metrics``; this is just the read view
        (``snapshot()``), namespaced ``load.* / predict.* / config.* / run.* /
        bake.*`` — the orchestrator no longer keeps its own copy."""
        self._ensure_loaded()
        return Metrics().snapshot()

    @property
    def timeline(self) -> Timeline | None:
        return self._timeline

    def run(self) -> bool:
        """Build timelines and write output. One-shot — calling twice is a programming bug."""
        if self._ran:
            logger.error("Pipeline.run() called more than once")
        self._ran = True
        bake_start = perf_counter()
        self._ensure_loaded()
        stages = list(self._stages.values())
        jst_timeline = Bake.timeline(stages)
        predict = Predict()
        # Predict pushes its own placement counts to Metrics (predict.*) as it runs.
        self._timeline = predict.predict(jst_timeline)
        # Reward structures + maps are curated config, not TracenModels stages, so
        # they don't ride the auto-discovery registry — load them here (upstream
        # of the bake) and hand them to Eishin.
        structures = load_reward_structures()
        maps = load_reward_maps()
        gacha = load_gacha_config()
        Metrics().set("config.reward_structures", len(structures))
        Metrics().set("config.reward_maps", len(maps))
        Metrics().set("config.gacha", 1)
        wrote = (
            Bake.academy(stages)
            and Bake.events(self._timeline)
            and Bake.config(structures, maps, gacha)
        )
        # stats.json rides last: it reports the run's total wall-clock and the
        # no-EN tally the encode hook accumulated across the three writes above.
        build_s = perf_counter() - bake_start
        Metrics().set("bake.build_s", build_s)
        return wrote and Bake.stats(self._timeline, stages, build_s)

    def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        self._loaded = True
        # First touch of this run's lifecycle — start Spechan's metrics fresh so a
        # second Pipeline in the same process can't read a previous run's tallies.
        Metrics().clear()
        run_start = perf_counter()
        for cls in TracenModels._registry:
            instance = cls()
            name = cls.__name__.lower()
            self._stages[name] = instance
            Metrics().set(f"load.{name}", instance.stats())
        Metrics().set("run.load_s", perf_counter() - run_start)
