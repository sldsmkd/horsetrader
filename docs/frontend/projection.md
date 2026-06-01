# Projection (pillar 2)

The engine that derives everything visible from the stored inputs. Pure `core/`,
no DOM, deterministic, headless-testable. This is the heart of the app.

> Status: design, not yet implemented.

## Mental model: a spreadsheet (with one caveat)

Columns are **event streams** (banner pulls, daily carats, login bonuses,
missions, monthly subs, champ-meeting, story events, …), each emitting dated
resource deltas; a final column is the **running sum** — a cumulative scan from
the dated snapshot forward.

But the *rows* are looser than a real spreadsheet, and this matters: **time is the
ordering axis, not a materialised grid.** We do **not** store a row per day —
empty days carry no row, and a single date can hold **multiple entries**. The only
place a per-step structure exists is the derived cumulative total, and even that
skips empty days: it's a **step function** over the dates where the balance
actually changes (see below).

## The ledger

The engine's output is a **ledger**: a list of attributed, dated, signed entries.

```
(date, source-stream, resource-type, signed-amount)
  e.g.  Daily Missions            → +75  carats_free
        spends·spend-30096-banner → -50  carats_paid
```

The ledger is **sparse and entry-keyed** — a list of entries, not a per-day grid.
A single date can carry **many** entries; dates with nothing carry none. It's the
rich, structure-preserving representation. **"Totals" are folds over it**, at two
levels:

- **Per-date subtotal** — the entries *on a given date* summed per resource (this
  is what the per-day hover tooltip shows). A date maps to a list of entries, not
  a single row.
- **Cumulative running total** — a **step function**: the balance changes only at
  the dates where entries land, and holds flat between them. This is the balance
  at any cursor position, the minimap's line, the final spreadsheet column. There
  is no point stored for an empty day.

Entries are facts; balances are always derived from them, never stored.

## Principles

### It's one pure fold over the merged timeline

`project(snapshot, config, commitments, favourites, bundle) → ledger`. Start at
the dated snapshot, accumulate each stream's deltas in date order. Deterministic
and side-effect-free, like the ETL's own discipline.

### Resources are a typed, keyed vector — per-dimension arithmetic

The accumulator is a map of named resources (carats free/paid, trainee/support
tickets, gold/rainbow uncap + shards, …), **not** a scalar. `carats_free` never
combines with `carats_paid`; there is a sum per dimension.

### Streams are independent, composable delta producers

Each stream just emits `(date, deltas)`. Adding a new reward source = adding a
stream, never editing the fold.

There are **two kinds of stream**:

- **ETL event-driven** — discrete dated events from the bundle (banners,
  missions, champ-meeting, story events). The client reads them.
- **Client-rehydrated procedural** — recurring sequences the client *generates*
  from a recurrence rule rather than the ETL emitting one event per occurrence
  (e.g. daily-login carats, daily pack, weekly-login). The client owns the
  *cadence*; it generates the sequence locally.

Either way the **values are never the client's to invent.** A procedural stream
decomposes into three ownerships:

| Ingredient | Owner | Example |
| --- | --- | --- |
| **Cadence / recurrence** | client logic | "every day from the snapshot forward" |
| **Values** | **ETL** (baked from upstream) | 50 carats per daily login |
| **Gating** | user config (persisted input) | is the subscription active? |

**A game-data literal in client code is a smell** (see
[conventions.md](conventions.md)). The client owns a stream's *shape*, never its
*numbers* — the `50` belongs in the bundle. This means the bundle must carry the
parameters/rates for procedural streams, not just the discrete event timeline.

### Balances are signed and ALLOWED to go negative — never clamp, never enforce

A negative balance is valid, communicative output (a pressure point), not an
error. There is **no "can't afford" guard, no floor at zero, anywhere**. The
planner informs; it does not enforce. The dip is the information.

### The engine holds signed numbers; formatting is a UI concern

The engine stores `-50`. How it's shown (sign, resource label, grouping) belongs
to **one formatter** in `ui/`. (The prototype's `+-50` was a display bug from
sign-prefixing an already-negative value — exactly the kind of thing one
centralised formatter prevents.)

## Performance: separate the expensive fold from the cheap query

This is the crux, and the reason it matters is the driver — *the budget is the
user's device* (see [architecture.md](architecture.md)).

- **Cache the computed series.** Scrubbing the date cursor must **never** re-fold
  — it's a lookup into the cached step function: binary-search the last
  change-point ≤ the cursor date and hold the balance from there, O(log n).
- **The fold reruns only when an input changes** (snapshot, a commitment,
  config), never on scrub or hover.
- **Recompute granularity: full scan, for now.** On any input change, recompute
  the whole projection from the snapshot forward. A few hundred events is cheap.
  Incremental / re-anchored recompute (a change at date T *mostly* affects results
  ≥ T) is tempting and may be worth it later — but it tangles directly with the
  anchor-boundary warning below, so it's an edge case to work through **when we
  actually implement the engine**, not a scheme to commit to in the design now.

## One ledger → many views

The detailed timeline, the per-day tooltip, the cursor balance, and the
whole-timeline scrubber are **all views over the one ledger and the one fold**.
The minimap is the proof: its line is the cumulative balance sampled coarsely;
its blobs are the favourites input on the date axis. No second engine, no
special-casing.

## ⚠️ WARNING: the snapshot anchor is NOT a clean temporal cut

**Read this before implementing any anchoring or incremental-recompute logic.**

Procedural generators can **start before the snapshot date and continue past it**.
Their contributions *after* the anchor depend on origin/phase established
*before* it, so you **cannot** compute them correctly by looking only at dates ≥
the anchor.

Concrete, from the old prototype's own saved state (snapshot date `2026-05-28`):

- `weekly_login_day1: 2026-05-24` — the weekly-login cycle's origin is **before**
  the snapshot; which day of the cycle you're on *at* the anchor depends on it.
- `daily_pack_until: 2026-06-09` — a daily-pack subscription bought **before** the
  snapshot that keeps paying out **after** it; its remaining duration depends on
  the pre-anchor purchase.

So a generator that straddles the anchor still **needs to be calculated** — its
pre-anchor history feeds its post-anchor output. This is exactly why we do a
**full scan** (above) rather than a clever re-anchored incremental pass: the
boundary semantics here are **not yet worked through**. Explore and account for
these edge cases when the engine is actually built; do not assume the anchor is a
clean cut.

## Deliberately-deferred optimisation (do NOT do yet)

The ETL streams are fixed/immutable baked data, so they *could* be folded down
once at startup into a precomputed baseline. **Don't.** Two kinds of caching get
opposite treatment:

- The **series cache + scrub-lookup split** above is *structure-preserving* —
  keep it.
- **Pre-folding the fixed streams** is *representation-collapsing and lossy*: it
  discards per-stream identity (which event contributed which delta), which the
  planner needs (per-stream attribution in the tooltip, toggling a stream,
  filtering by reward type, "what if I skip this banner" what-ifs).

The asymmetry: you can always collapse a rich representation later, but you can't
recover structure you optimised away. So keep streams **separate and live**, fold
naively, and only collapse once the feature set is settled *and* a real device
proves it necessary. It closes down possibility space — a post-hoc, measured
optimisation, never an early one.
