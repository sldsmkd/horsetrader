# Projection (pillar 2)

The engine that derives everything visible from the stored inputs. Pure `core/`,
no DOM, deterministic, headless-tested. Lives at
`horsetrader.site/js/src/core/engine/`. For the stream model, partition,
coordinator API, and registry roster see [engine.md](engine.md).

## Implementation status

**Complete.** `core/engine/` houses the full settled model:

- **`stream.ts`** — `SettledEvent` shape; `StreamCtx` carrying each stream's
  registry-routed slice of the bake.
- **`rules/settle.ts`** — face resolution + compound facet-expansion
  (`visible:false` cadence children keyed `<parent>-<date>`).
- **`rules/gradedstamp.ts`** — shared rule: event-source pricing events via the
  play-selected `reward_maps` row.
- **`streams/`** — `ground`, `missions`, `graded`, `synthesised` stream
  implementations. Synthesisers wrap the shared cadence modules (from
  `projection/streams/`) as internals.
- **`registry.ts`** — `buildRegistry` asserts claim disjointness + complement +
  mint fencing; `route()` slices the bundle per stream.
- **`fold.ts`** — the one generic fold: `flatPayload`, pay at `end`, at `start`
  when rushed.
- **`reconcile.ts`** — the third pipeline stage: commitments → ordered debits →
  P_final.
- **`coordinator.ts`** — the full public interface (see [engine.md](engine.md)).

The old `core/projection/streams/` stream files (events, generator, sequence,
routine, team-trials, club-rank, shop-tickets, training-pass, story,
champions-meeting, spends) and the old `core/coordinator/channels.ts` registry
are **deleted**. The synthesiser streams wrap the cadence primitives as internals
(`projection/streams/` survivors); `resolveTrainingPass` / `resolveDailyPack`
survive as importable helpers.

---

## Mental model: a spreadsheet (with one caveat)

Columns are **event streams** (banner commits, daily carats, login bonuses,
missions, CMs, story events, …), each emitting dated resource deltas; a final
column is the **running sum** — a cumulative scan from the dated snapshot forward.

But the *rows* are looser than a real spreadsheet, and this matters: **time is the
ordering axis, not a materialised grid.** We do **not** store a row per day —
empty days carry no row, and a single date can hold **multiple entries**. The only
place a per-step structure exists is the derived cumulative total, and even that
skips empty days: it's a **step function** over the dates where the balance
actually changes.

## The ledger

The engine's output is a **ledger**: a list of attributed, dated, signed entries.

```
(date, source-stream, resource-type, signed-amount)
  e.g.  Daily Missions            → +75  free_carats
        commitment: banner-kita   → -200 free_carats
```

The ledger is **sparse and entry-keyed** — a list of entries, not a per-day grid.
A single date can carry **many** entries; dates with nothing carry none. It's the
rich, structure-preserving representation. **"Totals" are folds over it**:

- **Per-date subtotal** — the entries *on a given date* summed per resource (this
  is what the per-day hover tooltip shows).
- **Cumulative running total** — a **step function**: the balance changes only at
  the dates where entries land, and holds flat between them. This is the balance
  at any cursor position, the minimap's line. There is no point stored for an
  empty day.

Entries are facts; balances are always derived from them, never stored.

---

## Principles

### It's one pure fold over the merged timeline

`fold(snapshot, streams) → ledger` — the coordinator assembles the bake, config,
and commitments into streams, asserts disjointness, takes their union (the settled
world), folds it, then runs a reconciliation pass for commitments. Start at the
dated snapshot, accumulate each stream's deltas in date order. Deterministic and
side-effect-free. `ctx` is frozen for a fold's duration; the projection is never
written, only derived.

### The core runs on calendar dates, branded at one ingress wall

The fold, ledger, axis, and dense balance cache are **day-bucketed** (`YYYY-MM-DD`),
not instant-based — deliberately. The dense `date → balance` cache (the O(1)
scrub lookup) is built by iterating *days*, and which calendar day a baked instant
lands on is **timezone-dependent** (the view timezone), a real feature. So we do
**not** carry full UTC instants through the core.

Baked event periods arrive as instants (`…T22:00:00+00:00`). They are converted to
a calendar date **once, at ingress** — `dateStringInTimeZone` — producing the
branded `CalendarDate` type (`core/projection/dates.ts`): a raw instant (a plain
`string`) is not assignable where a `CalendarDate` is expected, so the one place
that skips the conversion is a **compile error** rather than a silent fall-through.
The brand is compile-time only, erased at build; mint one via the converters or
`cal()` for a value already known to be a calendar date.

### Resources are a typed, keyed vector — per-dimension arithmetic

The accumulator is a map of named resources (`free_carats`, `paid_carats`,
`trainee_tickets`, `support_tickets`, …), **not** a scalar. `free_carats` never
combines with `paid_carats`; there is a sum per dimension.

### Streams and reconciliation

Streams come in two kinds by implementation (see [engine.md](engine.md) for the
full model):

- **Claimers** — price the baked events they own (pass through, stamp a
  play-graded row, or filter).
- **Synthesisers** — mint events the bake doesn't carry (`routine-dailies-<date>`,
  `visible: false`), reading baked rate tables for their values. Synthesisers'
  cadence logic is separated from their values: **the cadence is client logic; the
  values come from the bake.** A game-data literal in client code is a smell —
  that number belongs in `config.json`.

**Commitments are handled by reconciliation**, not a stream. A banner is just an
event; a commitment is account state the user raises against it. The coordinator's
third pipeline stage iterates `ctx.commitments`, dereferences each referent in the
settled world, and emits debits into P_final. See [engine.md](engine.md#reconciliation).

### Income posts on the last day; a commitment's claim debits on the first

**Income** contributions land on the day a stream has *fully* run — the realised
moment — not the day it starts. A Championship Meeting's reward is set by final
placement; a story's rewards land when it finishes. Claimers post at `event.end`.

A **banner commitment** splits the two timings:

- **Availability is *measured* at the banner's `end`** — by which point the
  window's tickets + daily + free pulls have all accrued.
- **The claim *debits* at the banner's `start`** — committing earmarks resources
  the moment the banner opens, so any later banner sees them already spoken for.
  The debit can dip the balance transiently negative mid-run (income still
  arriving) — that is fine and *meaningful*: a planner is not a bank, and a
  negative reads as a claim against income not yet in hand. By construction the
  overflow lands only on **free carats** (the cost-ascending order floors tickets
  at 0 and banks paid carats), so negative free carats is the single pressure
  dimension.

- **Exception — sequences/generators post per day.** The facet-expansion rule
  mints one `visible:false` cadence child per payout day; each is a one-day event
  paying at its own `end`. This is how compound shapes produce per-day attribution
  without special fold logic.
- **Rushing posts discrete rewards early (non-banner only).** An opt-in *rushed*
  event posts its **discrete** rewards at `start` instead of `end`. There is **no
  efficiency penalty**: rush only moves *where* the discrete deltas land, never
  their amount. Compound rewards (cadence children) do **not** move — they are
  dated facts. **Banners are not rushable** (stripped in the ETL): a banner has
  exactly one settle behaviour, the start-debit above. See the rushable-events
  section in [ui-timeline.md](ui-timeline.md#rushable-events-the-opt-in-inversion).

The UI leans on this rule — the minimap's balance line "lags" the appearance dots
by design — and [ui-timeline.md](ui-timeline.md) treats it as an engine semantic.
This is its home.

### Balances are signed and ALLOWED to go negative — never clamp, never enforce

A negative balance is valid, communicative output (a pressure point), not an
error. There is **no "can't afford" guard, no floor at zero, anywhere**. The fold
is **linear**: `balance = base + Σ deltas`. The planner informs; it does not
enforce. The dip is the information.

### The engine holds signed numbers; formatting is a UI concern

The engine stores `-50`. How it's shown (sign, resource label, grouping) belongs
to **one formatter** in `ui/`. (The prototype's `+-50` was a display bug from
sign-prefixing an already-negative value — exactly the kind of thing one
centralised formatter prevents.)

---

## Performance: separate the expensive fold from the cheap query

This is the crux, and the reason it matters is the driver — *the budget is the
user's device* (see [architecture.md](architecture.md)).

- **Cache the computed series.** Scrubbing the date cursor must **never** re-fold
  — it's a flat O(1) lookup into the cached **dense** `date → balance` dictionary.
  `balanceSeries` materialises a balance for every day across the extent. No
  sparse change-points + binary search: daily rewards densify the timeline anyway,
  so the dense dictionary is simpler *and* faster.
- **The fold reruns only when an input changes** (snapshot, a commitment, config),
  never on scrub or hover.
- **Recompute granularity: full scan.** On any input change, recompute the whole
  projection from the snapshot forward. A few hundred events is cheap. Incremental
  recompute is tempting and may be worth it later — but it tangles with the
  anchor-boundary semantics below.

## One ledger → many views

The detailed timeline, the per-day tooltip, the cursor balance, and the
whole-timeline minimap scrubber are **all views over the one ledger and the one
fold**. The minimap is the proof: its line is the cumulative balance sampled
coarsely; its blobs are the favourites input on the date axis. No second engine,
no special-casing.

## ⚠️ WARNING: the snapshot anchor is NOT a clean temporal cut

**Read this before implementing any anchoring or incremental-recompute logic.**

Procedural generators can **start before the snapshot date and continue past it**.
Their contributions *after* the anchor depend on origin/phase established
*before* it, so you **cannot** compute them correctly by looking only at dates ≥
the anchor.

Concrete, from the old prototype's saved state (snapshot date `2026-05-28`):

- `weekly_login_day1: 2026-05-24` — the weekly-login cycle's origin is **before**
  the snapshot; which day of the cycle you're on *at* the anchor depends on it.
- `daily_pack_until: 2026-06-09` — a daily-pack subscription bought **before** the
  snapshot that keeps paying out **after** it; its remaining duration depends on
  the pre-anchor purchase.

So a generator that straddles the anchor still **needs to be calculated** — its
pre-anchor history feeds its post-anchor output. This is exactly why we do a
**full scan** rather than a clever re-anchored incremental pass.

## Deliberately-deferred optimisation (do NOT do yet)

The ETL streams are fixed/immutable baked data, so they *could* be folded down
once at startup into a precomputed baseline. **Don't.** Two kinds of caching get
opposite treatment:

- The **series cache + scrub-lookup split** above is *structure-preserving* —
  keep it.
- **Pre-folding the fixed streams** is *representation-collapsing and lossy*: it
  discards per-stream identity (which event contributed which delta), which the
  planner needs (per-stream attribution in the tooltip, toggling a stream,
  "what if I skip this banner" what-ifs).

The asymmetry: you can always collapse a rich representation later, but you can't
recover structure you optimised away. So keep streams **separate and live**, fold
naively, and only collapse once the feature set is settled *and* a real device
proves it necessary.

## Culling fully-past events: don't (premature optimisation)

The projection is forward-only from the snapshot — but that is **already
guaranteed** by every stream's strictly-after-`after` per-emission filter, which
is also a *correctness* requirement: the snapshot is the user's actual balance, so
it already banked every past reward; re-emitting one would double-count. Given
that, **do not** add a pre-pass that prunes whole past events to "save work."

Two reasons. First, it buys nothing measurable — the bundle is a few hundred
events and the fold is naive-cheap. Second, the safe predicate is a trap: "past"
must be judged by a stream's *actual last payout date*, not the event record's
`end` — a cadence child can start before the snapshot and pay well past its
nominal `end`. Cull by `end` and you silently drop a straddler's future income.

If timeline volume *ever* becomes a real problem, the fix is upstream: the **ETL
stops baking 15-year-old history**, not the client growing a fiddly span-aware
prune.
