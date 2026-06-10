# Projection (pillar 2)

The engine that derives everything visible from the stored inputs. Pure `core/`,
no DOM, deterministic, headless-testable. This is the heart of the app.

## Implementation status

Partially built under `core/projection/`, all headless-tested (`npm test`):

- **The fold** — `project(snapshot, streams) → { ledger, series }` (`project.ts`).
- **The rich ledger + its folds** — `attribute` (emissions → single-resource,
  per-stream/per-source entries), `subtotals` (per-date), and `balanceSeries`
  with the cached `balanceAt` scrub lookup (`ledger.ts`).
- **Three ground-truth channels**, each a pure `(date, deltas)` producer kept on
  its own provenance channel (`streams/`):
  - **events** — discrete rewards landing on an event's `end`.
  - **generator** — recurring fixed payout (`{start, payload, repeat}` → one
    emission per day for `repeat` days; extracted from inline `rewards.generator`
    by `generatorsFromBundle`).
  - **sequence** — a per-day amount schedule for a single resource (`{start,
    resource, amounts: (int|null)[]}`, anchored at the event start; `null` =
    unpaid that day). This is the baked daily-login-bonus shape, extracted from
    inline `rewards.sequence` by `sequencesFromBundle`. The client and ETL share
    this shape: the ETL bakes income sequences (this channel), the client will
    generate *spending* strategies in the same shape (a separate channel — below).

  Reward keys *are* the engine's resource dimensions (the ETL bakes `free_carats`,
  `paid_carats`, … directly), so the channels read them unchanged — no vocab
  mapping layer. Shared UTC date arithmetic in `dates.ts`.
- **The coordinator** (`core/coordinator/`) — the headless seam joining
  persistence to projection. It loads the plan, builds the channels from the
  bundle (`channels.ts` registry), folds the *enabled* ones via `project()`, and
  recomputes on any input or toggle change. The UI drives it (`update`,
  `setEnabled`) and reads the result and stored plan (`projection`, `balanceAt`,
  `channels`, `document`, `recovered`); it never touches the DOM. **Stream toggles** live here: disabling a channel drops
  it from the next fold (it keeps existing, just stops contributing) and is
  **ephemeral** — never persisted into the plan (dev/debug isolation). The
  projection origin is the snapshot date, or the injected `now` before a snapshot
  is set.

**The balance series is the scrub cache, materialised densely.** `balanceSeries`
builds a balance for *every* calendar day across the timeline's extent (carrying
the running total across days with no entry), so `balanceAt` is a flat O(1)
`date → balance` lookup, never refolded on scrub. We do **not** keep sparse
change-points and binary-search between them: daily rewards make nearly every day
a change-point anyway, so the dense dictionary is both simpler and faster. The
series still exposes the change-points (`dates`, the step risers) and the dense
`extent` for views that want them.

### Still to come: the spends/commitments channel (now unblocked)

Spends/commitments are the **primary** user interaction ("commit this spend to
this banner, on this date") — but they are **not** core projection logic, and the
old prototype was wrong to intermingle spend resolution into the fold. The ETL
shipped the shared `SequenceReward` *value type* (the sequence channel above
ingests its baked income form), so the client now has the shape it needs and this
work is a **pure frontend task** — no longer ETL-blocked.

What remains is genuinely client-owned: the user's spends are a **collection of
strategies the client generates** in the sequence shape (negative deltas), then
overlays into one net daily delta. Unlike the ground-truth channels it is **not**
a clean `(date, deltas)` producer: a spend's deltas depend on the *running
balance* (affordability), so the channel must consume the fold's own output to
decide what it spends. That coupling — a stream that reads the projection-so-far —
is the real design problem, and is the substance of this slice.

**Persist the intent, derive the resolution.** Only the *commitment* (banner id →
committed pities, the unit of account) is stored input; the resolved carat
spend/sequences are **derived every recompute** from intent + current running
balance, never persisted. This is
what dissolves the old prototype's pain (plans relying on state that no longer
exists): there is no stored resolution to go stale, so nothing to repair — a
mutation just re-resolves. And when a downstream plan can no longer afford its
intent, **let the balance go negative** — that deficit is valid output (the
pressure point), not an error to back-propagate away. The reservation /
last-day-catch tangle in the old code was exactly that over-eager feasibility
repair; don't reintroduce it.

**Open exploration — the resolution ordering comparator.** Concurrent strategies
contend for the same shared resources, so resolution is *sequential* in a stable
total order, and that order is a priority decision still to settle. Current
leaning: **order by banner `end`, with banner id as the tie-breaker** — because
banners are *not* all fixed length, so the end date carries the real deadline
(fund the soonest-closing banner first) and id alone can't order them correctly.
Id-only would be deterministic but deadline-blind. Decide this deliberately when
the channel is built; the *mechanism* (stable order + sequential resolve) holds
regardless of the comparator.

### Next steps, in order

1. **Spends/commitments channel** — the client-generated strategy collection,
   overlay, and the balance-consuming affordability logic, outside the pure fold.
   Persist only the commitment intent; derive resolution each recompute. Settle
   the resolution-ordering comparator here (leaning `end`, id as tie-breaker).
   This is the one channel that consumes the fold's own output, so it slots into
   the coordinator's recompute as a second phase *after* the ground-truth fold,
   not as another independent entry in the `channels.ts` registry.
2. **Expected-copies distribution** — the plan surface ([ui.md](ui.md)) wants a
   probability distribution over outcomes (None / 0LB … MLB) for committed pulls:
   deterministic derived math over the commitment + **baked drop rates** (the
   rates are game-data, so they come from the bundle, never a client literal).

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
  e.g.  Daily Missions            → +75  free_carats
        spends·spend-30096-banner → -50  paid_carats
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

`project(snapshot, streams) → ledger` — the coordinator assembles the bundle,
config, commitments and favourites into those streams (see *Implementation
status* above; this is the real signature). Start at the dated snapshot,
accumulate each stream's deltas in date order. Deterministic and side-effect-free,
like the ETL's own discipline.

### The core runs on calendar dates, branded at one ingress wall

The fold, ledger, axis and dense balance cache are **day-bucketed** (`YYYY-MM-DD`),
not instant-based — deliberately. The dense `date → balance` cache (the O(1) scrub
lookup) is built by iterating *days*, and which calendar day a baked instant lands
on is **timezone-dependent** (the view timezone), a real feature. So we do **not**
carry full UTC instants through the core (a possibility once weighed and rejected:
its only real upside — a distinct sort order — is moot because banners release
simultaneously and fall back to id-tiebreak anyway).

Baked event periods arrive as instants (`…T22:00:00+00:00`). They are converted to
a calendar date **once, at ingress** — `dateStringInTimeZone` in each stream's
`*fromBundle`, in the coordinator's `committedBanners`, and in the UI bundle's
`createBundle`. That bucketed space is the branded `CalendarDate` type
(`core/projection/dates.ts`): a raw instant (a plain `string`) is not assignable
where a `CalendarDate` is expected, so the one place that skips the conversion is a
compile error rather than a silent fall-through. (This is the durable fix for the
spend-fold bug where a raw instant fell past the dense series to the far-future
tail — see `committedBanners` and its regression test.) The brand is compile-time
only, erased at build; mint one via the converters or `cal()` for a value already
known to be a calendar date.

### Resources are a typed, keyed vector — per-dimension arithmetic

The accumulator is a map of named resources (free/paid carats, trainee/support
tickets, gold/rainbow uncap + shards, …), **not** a scalar. `free_carats` never
combines with `paid_carats`; there is a sum per dimension.

### Streams are independent, composable delta producers

Each stream just emits `(date, deltas)`. Adding a new reward source = adding a
stream, never editing the fold.

There are **two kinds of stream**:

- **ETL event-driven** — discrete dated events from the bundle (banners,
  missions, champ-meeting, story events). The client reads them.
- **Client-rehydrated procedural** — recurring sequences the client *generates*
  from a recurrence rule rather than the ETL emitting one event per occurrence
  (e.g. daily-login carats, daily pack, weekly-login). The client owns the
  *cadence*; it generates the sequence locally. The first one built is the
  **`routine` channel** (`streams/routine.ts`, in `INCOME_CHANNELS`): it reads the
  account's `play.weeklyPlay` level + the baked `reward_structures.dailies` /
  `weekly-login`, and synthesises login-day income from the **server epoch** (earliest
  bundle date) to the timeline's right edge. Login days are spread evenly across each
  7-day block (`daysPerWeek`/7); the daily payload lands on every login; the login
  bonus advances **one slot per login**, resetting every 7 logins (indexed by login
  *count*, not weekday — log in 7× over 10 days and you collect the whole cycle). The
  cadence advances across the snapshot so the cycle phase is snapshot-independent. The
  second is the **`team-trials` channel** (`streams/teamtrials.ts`, also `INCOME_CHANNELS`):
  it reads `reward_maps.team-trials` + `play.teamTrials` and emits the weekly Team Trials
  carats on the **calendar Monday** at server reset. The carats are graded by the
  *transition into* a class (the map is keyed `<class>:<state>`); the client owns the
  per-Monday state cadence — a stable class walks a length-1 `:retention` cycle, a
  "flapping" account alternates `6:promotion`/`5:demotion` (a real two-week cycle, not the
  old `5.5` average). The flap phase anchors at the epoch and advances across the snapshot.
  The third is the **`club-rank` channel** (`streams/clubrank.ts`, also `INCOME_CHANNELS`):
  the team-trials twin, but **monthly** — it reads `reward_maps.club-rank` and emits a flat
  carat row **on the 1st of each month** at server reset (the monthly analogue of the Monday
  cadence; no transition state, so no cycle). Its selector is **identity, not play-style** —
  the rank comes from `resolveClubRank(config.identity.clubRank)` (defaulting to the trainer
  sheet's `B+` placeholder until an identity picker lands), threaded into the channel context
  as `clubRank`. The fourth is the **`shop-tickets` channel** (`streams/shoptickets.ts`): also
  **monthly on the 1st** (the shop refresh), but it has **no baked table** — its `shopTickets`
  play-style bracket *is* the count of scout tickets bought (`none`/`cleats`/`friendPoints`/
  `rainbow` → 0/4/6/7 of *each* type per month), an engagement gating choice like routine's
  days-per-week, not a game-data rate. The two monthly channels share `streams/monthly.ts`
  (`monthlyStream`); all four synthesised channels share `streams/span.ts` (`bundleSpan`). See
  [glue.md](glue.md).

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

### Income posts on the last day; a commitment's claim debits on the first

**Income** contributions land on the day a stream has *fully* run — the realised
moment — not the day it starts. Discrete income events credit on their `end`: a
Championship Meeting's reward is set by final placement; a story's rewards land
when it finishes. The events stream does exactly this (lands on `event.end`).

A **banner commitment** splits the two timings, because it is not a tracked spend
but an accounting **claim** (an earmark against resources):

- **Availability is *measured* at the banner's `end`** — by which point the
  window's tickets + daily + free pulls have all accrued, so that is where you
  read "how much could I spend."
- **But the claim *debits* at the banner's `start`** — committing earmarks the
  resources the moment the banner opens, so any later banner sees them already
  spoken for. The spends stream emits its negative deltas at `event.start`
  (`core/projection/streams/spends.ts`). The debit can dip the balance transiently
  negative mid-run (income still arriving) — that is fine and *meaningful*: a
  planner is not a bank, and a negative reads as a claim against income not yet in
  hand. By construction the overflow lands only on **free carats** (the
  cost-ascending order floors tickets at 0 and banks paid carats), so negative
  free carats is the single pressure dimension.

- **Exception — sequences/generators post per day.** A daily-cadence stream emits
  one discrete transaction *each* day across its run, not a single end-post —
  that is the whole point of those channels.
- **Rushing posts discrete rewards early (non-banner only, built).** An opt-in
  *rushed* event posts its **discrete** rewards at `start` instead of `end` — the
  impulse-control decision to grab the payout now rather than wait (not a planning
  lever). There is **no efficiency penalty**: rush only moves *where* the discrete
  deltas land, never their amount. Compound
  rewards (sequences/generators) do **not** move — their per-day attribution is
  unchanged. The `events` channel honours a `rushed` set (event keys → post-at-start)
  threaded through `ChannelContext`; the `after`-boundary check uses the *effective*
  date, so rushing an event whose `start` precedes the snapshot drops it (already
  banked). **Banners are not rushable** (stripped in the ETL 2026-06-10): a banner
  has exactly one settle behaviour, the start-debit above, so there is no banner-rush
  variant and `spends.ts` has no rush coupling. See the rushable-events section in
  [ui.md](ui.md).

The UI leans on this rule — the minimap's balance line "lags" the appearance dots
by design — and [ui.md](ui.md) treats it as a core/projection semantic. This is
its home.

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
  — it's a flat O(1) lookup into the cached **dense** `date → balance` dictionary
  (`balanceSeries` materialises a balance for every day across the extent). No
  sparse change-points + binary search: daily rewards densify the timeline anyway,
  so the dense dictionary is simpler *and* faster — `balanceAt` is a direct
  dictionary read.
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

### Culling fully-past events: don't (premature optimisation)

The projection is forward-only from the snapshot — but that is **already
guaranteed** by every channel's strictly-after-`after` per-emission filter, which
is also a *correctness* requirement: the snapshot is the user's actual balance, so
it already banked every past reward; re-emitting one would double-count. Given
that, **do not** add a pre-pass that prunes whole past events to "save work."

Two reasons. First, it buys nothing measurable — the bundle is a few hundred
events and the fold is naive-cheap. Second, the safe predicate is a trap: "past"
must be judged by a stream's *actual last payout date*, not the event record's
`end` — a generator/sequence can start before the snapshot and pay well past its
nominal `end` (golden-week: `end` Aug 7, pays through Aug 16). Cull by `end` and
you silently drop a straddler's future income (the anchor-boundary warning above,
made concrete). Not worth the risk for no gain.

If timeline volume *ever* becomes a real problem, the fix is upstream: the **ETL
stops baking 15-year-old history**, not the client growing a fiddly span-aware
prune. Premature optimisation is the root of all evil; this one also has teeth.
