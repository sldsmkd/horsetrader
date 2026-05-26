from abc import abstractmethod
from collections.abc import Iterable
from time import perf_counter
from typing import Any, ClassVar, Generic, TypeVar

from horsetrader.info import Logger
from horsetrader.semantics import tazuna

from .references import References
from .tracen_model import TracenModel

logger = Logger.get(__name__)

TPrimary = TypeVar("TPrimary")
TSecondary = TypeVar("TSecondary")
TMerged = TypeVar("TMerged", bound=TracenModel)


@tazuna
class TracenModels(Generic[TPrimary, TSecondary, TMerged]):
    """Cached, key-indexed collection over a two-source merge pipeline.

    Subclasses provide:
      - source wiring: `_fetch_primary`, `_enrich_one`, `_merge_one`,
        and (optionally) `_on_enrich_error`
      - per-item validation: `_validate_item`
      - reference URLs: set `SOURCES` or override `_collection_sources()`

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
        self._cache: list[TMerged] | None = None
        self._cache_by_key: dict[str, TMerged] = {}
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
            "count": len(self._cache or ()),
            "elapsed_s": self._load_elapsed_s,
        }

    def get(self, key: str) -> TMerged | None:
        if self._cache is None:
            self._fetch()
        return self._cache_by_key.get(key)

    def all(self, contains: str | None = None) -> list[TMerged]:
        items = list(self._cache) if self._cache is not None else self._fetch()
        if contains is None:
            return items
        needle = contains.lower()
        return [item for item in items if needle in item.key.lower()]

    def __iter__(self):
        return iter(self._fetch())

    def _collection_sources(self) -> Iterable[str]:
        """Override for sources only known at fetch time. Defaults to SOURCES."""
        return self.SOURCES

    @abstractmethod
    def _fetch_primary(self) -> Iterable[TPrimary]:
        ...

    @abstractmethod
    def _enrich_one(self, primary_item: TPrimary) -> TSecondary:
        ...

    @abstractmethod
    def _merge_one(self, primary_item: TPrimary, secondary_item: TSecondary) -> TMerged:
        ...

    @abstractmethod
    def _validate_item(self, item: TMerged) -> None:
        """Per-item validation, called once per merged item during `_fetch()`."""
        ...

    def _on_enrich_error(self, primary_item: TPrimary, error: Exception) -> TMerged:
        raise error

    def _fetch(self) -> list[TMerged]:
        if self._cache is not None:
            return list(self._cache)

        for url in self._collection_sources():
            self.references.add(url)

        merged: list[TMerged] = []
        for primary in self._fetch_primary():
            try:
                secondary = self._enrich_one(primary)
                merged.append(self._merge_one(primary, secondary))
            except Exception as error:
                merged.append(self._on_enrich_error(primary, error))

        for item in merged:
            self._validate_item(item)

        self._cache = merged
        self._cache_by_key = {item.key: item for item in merged if item.key}
        logger.info(f"Fetched {len(merged)} {type(self).__name__.lower()}")
        return list(self._cache)
