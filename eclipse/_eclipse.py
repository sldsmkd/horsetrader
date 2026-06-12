"""
eclipse.py — DISPOSABLE design mock for the Eclipse normalisation pass.

This is not the system. It is a thinking surface (see eclipse/OVERVIEW.md): a
runnable sketch of the producer/phase/namespace architecture from
1.NORMALISATION.md, so the API can be juggled in Python before any TS lands.
Business logic is stubbed to the point of being a lie; the *shapes* are the
point. Throw it away once the contract feels right.

Run: `python eclipse/eclipse.py`

What it embodies:
  - Producers identified by a dotted namespace  flow.selector.name   (§A)
  - Uniform control surface: enabled(ctx) + the phase's work method  (§B)
  - One object per producer, no FromBundle/Stream free-function pair (§C)
  - A phased fold  before(bundle) -> during -> P_income -> after -> P_final (§E)
  - `available` as a coordinator QUERY against P_income, not a phase output (§E)
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field, replace
from datetime import date, timedelta
from enum import Enum


# ──────────────────────────────────────────────────────────────────────────
# Core value types — the ledger substrate. Mirrors core/projection/ledger.ts.
# ──────────────────────────────────────────────────────────────────────────

Deltas = dict[str, int]  # signed resource vector, e.g. {"free_carats": 300}


@dataclass(frozen=True)
class Emission:
    """One dated bag of signed deltas, attributed to a specific sub-source."""
    date: date
    source: str          # a node in the namespace tree (id, or id.subsource)
    deltas: Deltas


@dataclass
class Projection:
    """A folded ledger + its balance query. The boundary value between phases."""
    emissions: list[tuple[str, Emission]]  # (producer id, emission)
    base: Deltas

    def balance_at(self, when: date) -> Deltas:
        out = dict(self.base)
        for _id, e in self.emissions:
            if e.date <= when:
                for k, v in e.deltas.items():
                    out[k] = out.get(k, 0) + v
        return out

    def total(self) -> Deltas:
        return self.balance_at(date.max)


def project(base: Deltas, tagged: list[tuple[str, list[Emission]]]) -> Projection:
    flat = [(pid, e) for pid, ems in tagged for e in ems]
    return Projection(emissions=flat, base=base)


# ──────────────────────────────────────────────────────────────────────────
# The bundle — STUBBED frozen fixture (~3rd anniversary). Stands in for the
# baked events + the prediction engine, which §way-of-working says to stub.
# ──────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Event:
    key: str
    type: str
    start: date
    end: date
    rewards: Deltas = field(default_factory=dict)


@dataclass(frozen=True)
class Bundle:
    events: tuple[Event, ...]


def frozen_bundle() -> Bundle:
    """A tiny pinned slice of JP timeline. Real shape, fake numbers."""
    d = date(2024, 2, 24)  # stand-in "3rd anniversary" origin
    return Bundle(events=(
        Event("anniv-2024",   "anniversary", d,                  d + timedelta(13), {"free_carats": 3000}),
        Event("story-fuji",   "story",       d + timedelta(20),  d + timedelta(33)),
        Event("cm-2024-03",   "cm",          d + timedelta(40),  d + timedelta(54)),  # no baked reward
        Event("banner-kita",  "trainee",     d + timedelta(5),   d + timedelta(18), {"pulls": 10}),
        Event("banner-sakura","support",     d + timedelta(12),  d + timedelta(25), {"pulls": 10}),
    ))


# ──────────────────────────────────────────────────────────────────────────
# Context — what a producer may read. The capability gradient is realised by
# WHICH method the phase calls, not by hiding fields here; ctx is the world.
# ──────────────────────────────────────────────────────────────────────────

@dataclass
class Ctx:
    bundle: Bundle
    origin: date                       # the snapshot date; emit strictly after
    play: dict[str, str]               # {"routine": "sixDays", "story": "focused", ...}
    config: dict                       # baked reward tables (stubbed dict)
    identity: dict                     # {"clubRank": "platinum", ...}
    subscriptions: dict                # {"dailyPack": date(...), "trainingPass": True}
    commitments: dict[str, int]        # {banner_key: pity}

    def with_bundle(self, bundle: Bundle) -> "Ctx":
        return replace(self, bundle=bundle)


# ──────────────────────────────────────────────────────────────────────────
# The three phase shapes. Each declares its namespaced id + enabled(ctx); the
# WORK METHOD differs by phase, and its signature IS the capability claim:
#   before  sees the bundle and rewrites it
#   during  sees only ctx
#   after   additionally sees the income projection
# ──────────────────────────────────────────────────────────────────────────

class Phase(Enum):
    BEFORE = "before"
    DURING = "during"
    AFTER = "after"


class Reshaper(ABC):
    """BEFORE: rewrite what the fold will see. (income.play.champions-meeting)"""
    id: str
    phase = Phase.BEFORE

    def enabled(self, ctx: Ctx) -> bool:
        return True

    @abstractmethod
    def apply(self, ctx: Ctx, bundle: Bundle) -> Bundle: ...


class Emitter(ABC):
    """DURING: an independent fixed-delta producer. The 11 channels live here."""
    id: str
    phase = Phase.DURING

    def enabled(self, ctx: Ctx) -> bool:
        return True

    @abstractmethod
    def emit(self, ctx: Ctx) -> list[Emission]: ...


class Dependent(ABC):
    """AFTER: reads the folded income balance. (spend.commitment.banners)"""
    id: str
    phase = Phase.AFTER

    def enabled(self, ctx: Ctx) -> bool:
        return True

    @abstractmethod
    def emit(self, ctx: Ctx, income: Projection) -> list[Emission]: ...


# ──────────────────────────────────────────────────────────────────────────
# Representative producers — one per interesting (phase x selector) cell.
# Logic is deliberately thin; we are feeling the API, not paying out carats.
# ──────────────────────────────────────────────────────────────────────────

class Events(Emitter):
    """income.ground.events — ground truth, no selector, folds baked rewards."""
    id = "income.ground.events"

    def emit(self, ctx: Ctx) -> list[Emission]:
        out = []
        for ev in ctx.bundle.events:
            deltas = {k: v for k, v in ev.rewards.items() if k != "pulls"}
            if deltas and ev.end > ctx.origin:
                out.append(Emission(ev.end, self.id, deltas))
        return out


class Routine(Emitter):
    """income.play.routine — the scale producer. Owns its sweetie<->sweaty map."""
    id = "income.play.routine"
    DAYS_PER_WEEK = {"twoDays": 2, "fourDays": 4, "sixDays": 6, "sevenDays": 7}

    def enabled(self, ctx: Ctx) -> bool:
        return ctx.play.get("routine") in self.DAYS_PER_WEEK

    def emit(self, ctx: Ctx) -> list[Emission]:
        # The stream reaches into ctx and decides what "be sweetie" means for it.
        days = self.DAYS_PER_WEEK[ctx.play["routine"]]
        daily = ctx.config["dailies"]["free_carats"]
        out = []
        # one stubbed "week" of logins after origin; sub-source = id.dailies
        for k in range(days):
            when = ctx.origin + timedelta(k + 1)
            out.append(Emission(when, f"{self.id}.dailies", {"free_carats": daily}))
        return out


class ClubRank(Emitter):
    """income.identity.club-rank — selector is IDENTITY, not play-style."""
    id = "income.identity.club-rank"

    def enabled(self, ctx: Ctx) -> bool:
        return ctx.identity.get("clubRank") is not None

    def emit(self, ctx: Ctx) -> list[Emission]:
        row = ctx.config["club-rank"][ctx.identity["clubRank"]]
        # one stubbed monthly payout after origin
        return [Emission(ctx.origin + timedelta(7), self.id, dict(row))]


class ChampionsMeeting(Reshaper):
    """income.play.champions-meeting — taxonomically income.play, PHASE before.
    The orthogonality proof: stamps the rank reward onto CM records so the plain
    Events emitter folds it (and the card can render it)."""
    id = "income.play.champions-meeting"

    def enabled(self, ctx: Ctx) -> bool:
        return ctx.play.get("championsMeeting", "skip") != "skip"

    def apply(self, ctx: Ctx, bundle: Bundle) -> Bundle:
        reward = ctx.config["champions-meeting"][ctx.play["championsMeeting"]]
        events = tuple(
            replace(ev, rewards={**ev.rewards, **reward}) if ev.type == "cm" else ev
            for ev in bundle.events
        )
        return Bundle(events=events)


class Banners(Dependent):
    """spend.commitment.banners — AFTER. Pure ordered pass against income.
    Both emit() and the coordinator's availability query call _resolve()."""
    id = "spend.commitment.banners"

    def enabled(self, ctx: Ctx) -> bool:
        return any(p > 0 for p in ctx.commitments.values())

    def _committed(self, ctx: Ctx) -> list[Event]:
        evs = [e for e in ctx.bundle.events
               if e.type in ("trainee", "support")
               and ctx.commitments.get(e.key, 0) > 0
               and e.start > ctx.origin]
        return sorted(evs, key=lambda e: (e.start, e.key))

    def _resolve(self, ctx: Ctx, income: Projection) -> tuple[list[Emission], dict[str, Deltas]]:
        """The single ordered pass. Returns emissions AND per-banner available;
        emit() keeps the emissions, the availability query keeps the map."""
        emissions: list[Emission] = []
        available: dict[str, Deltas] = {}
        spent: Deltas = {}
        carats_per_pull = ctx.config["gacha"]["caratsPerPull"]
        for ev in self._committed(ctx):
            # available = income at this banner's END minus earlier-by-start claims.
            avail = income.balance_at(ev.end)
            for k, v in spent.items():
                avail[k] = avail.get(k, 0) - v
            available[ev.key] = avail
            cost = ctx.commitments[ev.key] * carats_per_pull
            emissions.append(Emission(ev.start, self.id, {"free_carats": -cost}))
            spent["free_carats"] = spent.get("free_carats", 0) + cost
        return emissions, available

    def emit(self, ctx: Ctx, income: Projection) -> list[Emission]:
        return self._resolve(ctx, income)[0]


# ──────────────────────────────────────────────────────────────────────────
# The registry + the phased fold. coordinator.fold() becomes "run the phases".
# ──────────────────────────────────────────────────────────────────────────

REGISTRY: list = [
    Events(),
    Routine(),
    ClubRank(),
    ChampionsMeeting(),
    Banners(),
]


def _by_phase(phase: Phase) -> list:
    return [p for p in REGISTRY if p.phase is phase]


@dataclass
class FoldResult:
    income: Projection   # the during/after boundary — availability queries hit this
    final: Projection    # income + spends flattened


def fold(ctx: Ctx, base: Deltas) -> FoldResult:
    # before: reshapers compose, registry order = fold order.
    bundle = ctx.bundle
    for r in _by_phase(Phase.BEFORE):
        if r.enabled(ctx):
            bundle = r.apply(ctx, bundle)
    ctx = ctx.with_bundle(bundle)

    # during: independent emitters -> P_income.
    income_tagged = [(e.id, e.emit(ctx)) for e in _by_phase(Phase.DURING) if e.enabled(ctx)]
    income = project(base, income_tagged)

    # after: dependent passes read P_income -> P_final.
    final_tagged = list(income_tagged)
    for d in _by_phase(Phase.AFTER):
        if d.enabled(ctx):
            final_tagged.append((d.id, d.emit(ctx, income)))
    final = project(base, final_tagged)

    return FoldResult(income=income, final=final)


def banner_available(ctx: Ctx, income: Projection, key: str) -> Deltas | None:
    """The §E query: NOT a phase output. Re-runs the spends ordered pass against
    P_income on demand. Legitimised by the shield's single-threaded
    BEGIN/UPDATE/COMMIT — every read is against a settled world."""
    banners = next((p for p in REGISTRY if isinstance(p, Banners)), None)
    if banners is None or not banners.enabled(ctx):
        return None
    _, available = banners._resolve(ctx, income)
    return available.get(key)


# ──────────────────────────────────────────────────────────────────────────
# Juggling surface — run it and look.
# ──────────────────────────────────────────────────────────────────────────

def demo() -> None:
    ctx = Ctx(
        bundle=frozen_bundle(),
        origin=date(2024, 2, 24),
        play={"routine": "sixDays", "championsMeeting": "groupBWinner"},
        config={
            "dailies": {"free_carats": 75},
            "club-rank": {"platinum": {"free_carats": 500}},
            "champions-meeting": {"groupBWinner": {"free_carats": 1000, "support_tickets": 2}},
            "gacha": {"caratsPerPull": 150},
        },
        identity={"clubRank": "platinum"},
        subscriptions={},
        commitments={"banner-kita": 100},  # 100 pity committed
    )
    base = {"free_carats": 10000}

    result = fold(ctx, base)

    print("== producers by phase ==")
    for ph in Phase:
        ids = [p.id for p in _by_phase(ph)]
        print(f"  {ph.value:6} {ids}")

    print("\n== P_income ledger ==")
    for pid, e in result.income.emissions:
        print(f"  {e.date}  {e.source:34} {e.deltas}")

    print("\n== P_final (with spends) ==")
    for pid, e in result.final.emissions:
        print(f"  {e.date}  {e.source:34} {e.deltas}")

    print("\n== availability query (P_income, not P_final) ==")
    print(f"  banner-kita available: {banner_available(ctx, result.income, 'banner-kita')}")

    print(f"\n  income total: {result.income.total()}")
    print(f"  final  total: {result.final.total()}")


if __name__ == "__main__":
    demo()
