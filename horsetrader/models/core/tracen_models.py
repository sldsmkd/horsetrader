from abc import abstractmethod
from collections.abc import Callable, Iterable
from time import perf_counter
from typing import Any, ClassVar, Generic, TypeVar

from horsetrader.info import Logger
from horsetrader.semantics import tazuna

from .references import References
from .tracen_model import TracenModel

logger = Logger.get(__name__)

TEntity = TypeVar("TEntity", bound=TracenModel)


@tazuna
class TracenModels(Generic[TEntity]):
    """Cached, key-indexed collection over a seed + optional-enrichment pipeline.

    Subclasses provide:
      - source wiring: `_fetch_primary` builds the initial entities; `_enrichers`
        returns an ordered tuple of methods that mutate each entity in place
        with field-level ternaries (candidate-beats-existing per field).
      - per-item validation: `_validate_item`
      - reference URLs: set `SOURCES` or override `_collection_sources()`

    Enrichment is targeted at fields, not the whole entity. Each enricher knows
    which fields its source can contribute to and folds in via assignment with
    a ternary (e.g. `c.name = record.get("name", c.name)`). Fields the enricher
    doesn't know about are untouched. `key` is the only immutable field by
    convention.

    Eager-load by design: `__init__` calls `_fetch()` so the scraper context
    stays warm across the ETL load-order graph.

    Consumers subclass `Entity`/`Entities` from `horsetrader.models.entities`,
    which are semantic wrappers around `TracenModel`/`TracenModels`.
    """

    SOURCES: tuple[str, ...] = ()
    _registry: ClassVar[list[type]] = []
    _load_counter: ClassVar[int] = 0

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        # Register only fully-concrete subclasses — intermediates like
        # `Entities` still inherit `_fetch_primary` as abstract.
        fetch_primary = getattr(cls, "_fetch_primary", None)
        if fetch_primary is not None and not getattr(
            fetch_primary, "__isabstractmethod__", False
        ):
            TracenModels._registry.append(cls)

    def __init__(self) -> None:
        self._cache: dict[str, TEntity] = {}
        self._loaded: bool = False
        self.references: References = References()
        load_start = perf_counter()
        self._fetch()
        self._load_elapsed_s = perf_counter() - load_start
        TracenModels._load_counter += 1
        self._load_order = TracenModels._load_counter

    def stats(self) -> dict[str, Any]:
        """Per-collection metrics for the pipeline record.

        Default: count + load wall-clock. Subclasses override to add fields
        the model is uniquely positioned to know (per-source counts, enrich
        failures, validation drops, sub-timings).
        """
        return {
            "load_order": self._load_order,
            "count": len(self._cache),
            "elapsed_s": self._load_elapsed_s,
        }

    def get(self, key: str) -> TEntity | None:
        if not self._loaded:
            self._fetch()
        return self._cache.get(key)

    def search(self, query) -> list[TEntity]:
        """Return all items matching ``query``.

        Delegates per-item to ``TracenModel.match`` (override there to extend
        the searchable surface). Subclasses may override to add type-based
        dispatch and call ``super().search(query)`` for the str path.
        """
        if isinstance(query, str):
            if not self._loaded:
                self._fetch()
            return [item for item in self._cache.values() if item.match(query)]
        raise TypeError(
            f"{type(self).__name__}.search does not support query type "
            f"{type(query).__name__!r}"
        )

    def __getitem__(self, key: str) -> TEntity:
        if not self._loaded:
            self._fetch()
        return self._cache[key]

    def __contains__(self, key: object) -> bool:
        if not self._loaded:
            self._fetch()
        return key in self._cache

    def __len__(self) -> int:
        if not self._loaded:
            self._fetch()
        return len(self._cache)

    def __iter__(self):
        if not self._loaded:
            self._fetch()
        return iter(self._cache)

    def keys(self):
        if not self._loaded:
            self._fetch()
        return self._cache.keys()

    def values(self):
        if not self._loaded:
            self._fetch()
        return self._cache.values()

    def items(self):
        if not self._loaded:
            self._fetch()
        return self._cache.items()

    def _collection_sources(self) -> Iterable[str]:
        """Override for sources only known at fetch time. Defaults to SOURCES."""
        return self.SOURCES

    @abstractmethod
    def _fetch_primary(self) -> Iterable[TEntity]:
        """Build initial entities from the primary source. Required."""
        ...

    def _enrichers(self) -> Iterable[Callable[[TEntity], None]]:
        """Override to declare ordered enrichment stages. Default: none.

        Each enricher mutates the entity in place, folding in candidate field
        values via ternary (last enricher wins per field unless the enricher
        itself checks for an existing value). Enrichers should not raise on
        missing data — return silently and let the entity keep its existing
        field values.
        """
        return ()

    @abstractmethod
    def _validate_item(self, item: TEntity) -> None:
        """Per-item validation, called once per merged item during `_fetch()`."""
        ...

    def _on_enrich_error(
        self,
        entity: TEntity,
        enricher: Callable[[TEntity], None],
        error: Exception,
    ) -> None:
        """Default: log and leave the entity in whatever partial state it's in.

        Override to raise, to roll back partial mutations, or to record a
        per-source enrichment failure count in `stats()`.
        """
        logger.warning(
            f"Enricher {enricher.__name__} failed for {type(entity).__name__} "
            f"{entity.key}: {error}"
        )

    def _fetch(self) -> None:
        if self._loaded:
            return

        for url in self._collection_sources():
            self.references.add(url)

        entities = list(self._fetch_primary())
        enrichers = tuple(self._enrichers())
        for entity in entities:
            for enricher in enrichers:
                try:
                    enricher(entity)
                except Exception as error:
                    self._on_enrich_error(entity, enricher, error)

        for item in entities:
            self._validate_item(item)

        # Key-indexed access is the contract for the collection; unkeyed items
        # would be silently invisible to every accessor, so drop them at load
        # with a warning rather than letting them inflate stats counts.
        # Duplicate keys are unlikely but a real bug-class — warn if seen.
        self._cache = {}
        dropped = 0
        for item in entities:
            if not item.key:
                dropped += 1
                continue
            if item.key in self._cache:
                logger.warning(
                    f"Duplicate key {item.key!r} in {type(self).__name__.lower()}; "
                    f"later item overwrites earlier"
                )
            self._cache[item.key] = item
        if dropped:
            logger.warning(
                f"Dropped {dropped} unkeyed {type(self).__name__.lower()}"
            )
        self._loaded = True
        logger.info(f"Fetched {len(self._cache)} {type(self).__name__.lower()}")
