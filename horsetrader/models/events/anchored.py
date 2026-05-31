from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import timedelta, tzinfo

from msgspec import UNSET

from horsetrader.core import JST, Period, Periods, SingletonMeta, StableKey
from horsetrader.info import Logger
from horsetrader.models.core import References
from horsetrader.models.rewards import rewards_from_baked
from horsetrader.output._records import AnchoredEventRecord
from horsetrader.semantics import daitaku

from .event import Event
from .events import Events

logger = Logger.get(__name__)


@daitaku
@dataclass
class AnchoredEvent(Event):
    """A curated lead-in / extension pinned to one edge of another event.

    Its period is *derived*, never authored: `relation` picks the anchor edge
    (`before` ends at the anchor's start; `after` begins at the anchor's end)
    and `duration` is the span. Because an `after` exposes its own end, these
    chain — one `AnchoredEvent` can be another's `anchor`. The launch placement
    happens at load (JST, deterministic); the EN/UTC edge is derived later by
    `AnchorPredictor` from the anchor's predicted UTC date.
    """

    name: str | None = field(default=None, kw_only=True)
    anchor: StableKey = field(kw_only=True)
    relation: str = field(kw_only=True)
    duration: timedelta = field(kw_only=True)

    def match(self, query: str) -> bool:
        return super().match(query) or (
            self.name is not None and query.lower() in self.name.lower()
        )

    def bake(self, period: Period) -> AnchoredEventRecord:
        # A calendar-style record (the base envelope, with `start`/`end` a real
        # derived span rather than a single instant) plus the placement contract
        # the web side groups on: `relation` (before/after) and the `anchor` key
        # it hangs off. Carries its own display `name` when curated, else the
        # key is omitted (UNSET).
        return AnchoredEventRecord(
            **self._envelope(period),
            relation=self.relation,
            anchor=self.anchor,
            name=self.name if self.name else UNSET,
        )


@dataclass(frozen=True)
class AnchorSpec:
    """The placement inputs for one anchored node, tz-agnostic."""

    anchor: StableKey
    relation: str
    duration: timedelta


def place(spec: AnchorSpec, anchor_period: Period) -> Period:
    """Position `spec` against a resolved `anchor_period`, in that period's tz.

    `before` runs up to the anchor's start edge; `after` runs from its end edge
    (start == end for span-0 launches, so base anchors are unambiguous). The
    derived period inherits the anchor's `predicted` flag — a campaign hung off
    a predicted EN date is itself a prediction.
    """
    if spec.relation == "before":
        start = anchor_period.start - spec.duration
    elif spec.relation == "after":
        start = anchor_period.end
    else:  # pragma: no cover - loader guarantees one of the two
        raise ValueError(f"unknown relation {spec.relation!r}")
    return Period(start=start, span=spec.duration, predicted=anchor_period.predicted)


def resolve_anchored(
    specs: dict[StableKey, AnchorSpec],
    base_period: Callable[[StableKey], Period | None],
) -> tuple[dict[StableKey, Period], list[StableKey]]:
    """Topologically place every anchored node, following chains to a fixpoint.

    `base_period(key)` returns the resolved Period for a *non-anchored* key (a
    base launch) in the target tz, or None when that key carries no period in
    this tz. Anchored-to-anchored references resolve from the running result,
    so chains fall out in dependency order regardless of declaration order.

    Returns `(resolved, unresolved)`. A node is unresolved when its anchor is
    unknown, carries no period in this tz, or sits in a cycle — the caller
    decides whether that's fatal (load: yes; UTC prediction: just unpredicted).
    """
    resolved: dict[StableKey, Period] = {}
    remaining = dict(specs)
    progress = True
    while remaining and progress:
        progress = False
        for key in list(remaining):
            spec = remaining[key]
            anchor_period = resolved.get(spec.anchor) or base_period(spec.anchor)
            if anchor_period is None:
                continue
            resolved[key] = place(spec, anchor_period)
            del remaining[key]
            progress = True
    return resolved, list(remaining)


@daitaku
class AnchoredEvents(Events[AnchoredEvent], metaclass=SingletonMeta):
    def search(self, query) -> list[AnchoredEvent]:
        return super().search(query)

    def _validate_item(self, item: AnchoredEvent) -> None:
        if not item.periods:
            logger.warning("Anchored event %s has no periods", item.key)
        if not item.name:
            # Anchored events are displayable, so the client wants a name; it
            # falls back to an empty box without one. Absence is a curation
            # nudge, not a failure (cf. rewards, which are legitimately absent
            # and simply omit their key) — so warn rather than raise.
            logger.warning("Anchored event %s has no display name", item.key)

    def _fetch_primary(self) -> list[AnchoredEvent]:
        from horsetrader.extractors.static import Static

        records = Static().anchored_events()
        if not records:
            return []

        specs = {
            StableKey(r["key"]): AnchorSpec(
                StableKey(r["anchor"]), r["relation"], r["duration"]
            )
            for r in records
        }
        resolved, unresolved = resolve_anchored(specs, self._anchor_jst)
        if unresolved:
            source = records[0]["source"]
            raise ValueError(
                f"{source}: unmoored anchored events (anchor missing, has no JST "
                f"period, or is cyclic): {sorted(unresolved)}"
            )

        events: list[AnchoredEvent] = []
        for record in records:
            key = StableKey(record["key"])
            raw_rewards = record.get("rewards")
            events.append(
                AnchoredEvent(
                    key=key,
                    periods=Periods([resolved[key]]),
                    name=record.get("name"),
                    anchor=StableKey(record["anchor"]),
                    relation=record["relation"],
                    duration=record["duration"],
                    references=References([record["source"]]),
                    rewards=rewards_from_baked(raw_rewards) if raw_rewards else None,
                )
            )
        return events

    def _anchor_jst(self, key: StableKey) -> Period | None:
        """JST Period for a base launch this collection can anchor to.

        Consults the curated point-launch collections (anchors — New Year /
        Golden Week / anniversaries — and scenarios). Anchored-to-anchored
        references are handled by `resolve_anchored` itself and never reach here.
        """
        return self._base_period(key, JST)

    def _base_period(self, key: StableKey, tz: tzinfo) -> Period | None:
        # Imported lazily so this module doesn't pin a sibling-collection import
        # order; both are SingletonMeta, so this just hands back the warm
        # instance (loading it on first touch).
        from .anchor import Anchors
        from .scenario import Scenarios

        for collection in (Anchors(), Scenarios()):
            event = collection.get(key)
            if event is not None:
                return next((p for p in event.periods if p.tzinfo == tz), None)
        return None
