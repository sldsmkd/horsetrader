from datetime import datetime, timezone
from pathlib import Path
from typing import Type

import msgspec

from horsetrader.core import Config, JST, Japlish
from horsetrader.info import Logger, Metrics
from horsetrader.models.config import GachaConfig
from horsetrader.models.core import TracenModel, TracenModels
from horsetrader.models.entities.entities import Entities
from horsetrader.models.events.events import Events
from horsetrader.models.media import ImageRegistry
from horsetrader.models.rewards import RewardMap, RewardStructure
from horsetrader.semantics import eishin
from horsetrader.timeline import Timeline

from ._mappers import MAPPERS
from ._records import Academy, BakeStats, ConfigBundle, EventsBundle, ImagesBundle

logger = Logger.get(__name__)


@eishin
class Bake:
    @staticmethod
    def _enc_hook(obj: object) -> object:
        # Every `Japlish` in the bundle funnels through here at encode time — the one
        # place Eishin "encounters" each one. The wire is EN-facing, so render the
        # EN-preferring `.display`; if no English translation is attached, `.display`
        # still falls back to JP/base (the bundle stays populated). Logged at INFO,
        # not WARNING: the automated race-lookup gains (#63) are captured, and the
        # residue is known manual-curation work (NAR/overseas race EN + support-card
        # flavour quotes), so the gap is a tracked backlog, not a regression to alarm
        # on. The distinct misses are tracked on `Metrics` (`bake.no_en`) — `stats()`
        # reads the count back for the MANGOHORSE NO-EN gauge.
        if isinstance(obj, Japlish):
            try:
                obj.en
            except ValueError:
                Metrics().track("bake.no_en", repr(obj))
                logger.info(f"Japlish has no EN translation, baking fallback: {obj!r}")
            return obj.display

        # Stable keys (and any other `str` subclass) flow into `str`-typed record
        # fields; msgspec's strict encoder won't auto-coerce a subclass, so narrow it.
        if isinstance(obj, str):
            return str(obj)
        raise NotImplementedError(f"Unencodable bake type: {type(obj).__name__}")

    @staticmethod
    def academy(models: list[TracenModels]) -> bool:
        """Write academy.json (+ schema) from the entity collections.

        The orchestrator gives us the world; we pick the `Entities` and fold
        each into its stable-key → record map. Field names on `Academy` match
        the collection class names lowercased, so `**` assembly is exact — a
        missing or extra collection fails loud at construction.
        """
        entities = [m for m in models if isinstance(m, Entities)]
        academy = Academy(
            **{type(c).__name__.lower(): Bake._collect(c) for c in entities}
        )
        return Bake._write(academy, Academy, "academy.json")

    @staticmethod
    def events(timeline: Timeline) -> bool:
        """Write events.json (+ schema) from the EN Timeline produced by Predict.

        A flat list sorted by the Timeline's tz (UTC) start. Each entry's
        `start`, `end`, and `predicted` come from the matched Period, not the
        model's own field; `event.bake(period)` returns the tagged wire record.
        """
        records = []
        for event in timeline:
            # Timeline invariant: every event carries a period in its tz, so
            # `next(...)` always succeeds — a missing one would be a contract
            # violation upstream (Timeline._validate / Predict) and should
            # raise here rather than be silently skipped.
            period = next(p for p in event.periods if p.tzinfo == timeline.tz)
            records.append(event.bake(period))
        return Bake._write(EventsBundle(events=records), EventsBundle, "events.json")

    @staticmethod
    def images() -> bool:
        """Write images.json (+ schema) — every published image's intrinsic size.

        Pure read of Curren Chan's ``ImageRegistry``, which she filled as she
        published each image during model build (upstream of this serialise). The
        front-end's image broker resolves dims by published url to stamp explicit
        ``width``/``height`` on every ``<img>``. Sorted by url for stable output.
        """
        dims = {url: [w, h] for url, (w, h) in sorted(ImageRegistry().entries().items())}
        return Bake._write(ImagesBundle(dims=dims), ImagesBundle, "images.json")

    @staticmethod
    def config(
        structures: dict[str, RewardStructure],
        maps: dict[str, RewardMap],
        gacha: GachaConfig,
    ) -> bool:
        """Write config.json (+ schema) — the non-timeline baked-config channel.

        Folds the flat structures and the rank-graded maps into their respective
        buckets (`RewardStructure.bake` / `RewardMap.bake`), sorted by key for
        stable output. The bucket already namespaces each entry, so the wire key
        drops the matching stable-key prefix (`reward-structure-dailies` →
        `dailies`) — the curated key keeps it for keystore `select()`. The gacha
        config is already built upstream too. Eishin only serialises here; config
        is loaded upstream (Rudolf) and handed in, never fetched by the bake.
        """
        reward_structures = {
            key.removeprefix("reward-structure-"): s.bake()
            for key, s in sorted(structures.items())
        }
        reward_maps = {
            key.removeprefix("reward-map-"): m.bake() for key, m in sorted(maps.items())
        }
        return Bake._write(
            ConfigBundle(
                reward_structures=reward_structures,
                reward_maps=reward_maps,
                gacha=gacha.bake(),
            ),
            ConfigBundle,
            "config.json",
        )

    @staticmethod
    def stats(timeline: Timeline, models: list[TracenModels], build_s: float) -> bool:
        """Write stats.json — the bake's vanity counters for the MANGOHORSE HUD.

        Called last in the run so the `no_en` tally is complete: the encode hook
        accumulates it across the academy/events/config writes. `predicted` /
        `confirmed` split the baked events on their selected-tz period's `predicted`
        flag (forecast vs already-announced EN window); `entities` rolls up every
        academy collection's count. `build_s` is the run's total wall-clock, handed
        in by the orchestrator (the only timing the bake itself doesn't measure)."""
        events = list(timeline)
        predicted = sum(
            next(p for p in e.periods if p.tzinfo == timeline.tz).predicted
            for e in events
        )
        entities = sum(len(m) for m in models if isinstance(m, Entities))
        # Source documents Shakur read this run — the HTML + JSON she fetched/served
        # to build the bundle. The customer-facing depth number.
        sources = Metrics().count("shakur.content_type.html") + Metrics().count(
            "shakur.content_type.json"
        )
        bundle = BakeStats(
            # UTC: the Global server runs on UTC and players calibrate around it, so
            # the freshness stamp rides the same clock the audience already reads.
            baked_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            build_s=round(build_s, 2),
            events=len(events),
            predicted=predicted,
            confirmed=len(events) - predicted,
            entities=entities,
            sources=sources,
            no_en=Metrics().count("bake.no_en"),
        )
        return Bake._write(bundle, BakeStats, "stats.json")

    @staticmethod
    def timeline(models: list[TracenModels]) -> Timeline:
        """Build the base JST Timeline from all Events collections in the stage list."""
        tl = Timeline(JST)
        for collection in models:
            if isinstance(collection, Events):
                tl.extend(collection.values())
        return tl

    # ── serialisation ───────────────────────────────────────────────────────

    @staticmethod
    def _write(bundle: msgspec.Struct, schema_type: Type, filename: str) -> bool:
        """Encode `bundle`, self-validate it, then write the JSON and its schema.

        Self-validation decodes the freshly-encoded bytes back through
        `schema_type` — which is the same Struct the published schema is
        generated from — so a bundle that wouldn't validate against the
        contract physically can't be written. The bundle is already
        correct-by-construction (the records are typed); this closes the loop
        for anything the type system can't catch (e.g. the open rewards dict).
        """
        blob = msgspec.json.encode(bundle, enc_hook=Bake._enc_hook)
        msgspec.json.decode(blob, type=schema_type)  # fail loud before writing

        json_dir = Config().static / "json"
        json_dir.mkdir(parents=True, exist_ok=True)
        Bake._dump(json_dir / filename, blob)
        # Schema isn't shippable — it lives in config/schema/, out of the deploy dir.
        Bake._dump(
            Config().schema / f"{Path(filename).stem}.schema.json",
            msgspec.json.encode(msgspec.json.schema(schema_type)),
        )
        return True

    @staticmethod
    def _dump(path: Path, blob: bytes) -> None:
        # Pretty-print to match the old `json.dumps(indent=2)` output; msgspec
        # emits raw UTF-8 (no `\uXXXX` escaping), i.e. `ensure_ascii=False`.
        path.write_bytes(msgspec.json.format(blob, indent=2))

    @staticmethod
    def _collect(collection: TracenModels) -> dict:
        serialized = {key: Bake._serialize(model) for key, model in collection.items()}
        return dict(sorted(serialized.items()))

    @staticmethod
    def _serialize(model: TracenModel) -> msgspec.Struct:
        mapper = MAPPERS.get(type(model))
        if mapper is None:
            raise TypeError(f"No mapper for {type(model).__name__}")
        return mapper(model)
