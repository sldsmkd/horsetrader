# Engine

The economic model that sits between the bake and the UI. Pure `core/`, no DOM,
headless-testable. Lives at `horsetrader.site/js/src/core/engine/`. See also
[projection.md](projection.md) for the ledger model, fold invariants, and
performance principles; [architecture.md](architecture.md) for the system-level
picture.

**The loop:** shields write account state → streams read it into events → the
fold reads events into money → surfaces read both → repeat. Nothing else moves.

---

## The model

### Stream

```ts
Stream = id + enabled(ctx) + claims + events(ctx) → list[Event]
```

- **`id`** — dotted `selector.name` (`play.dailies`, `ground.events`,
  `subscription.daily-pack`). Names the stream; never names events. The `flow`
  axis (`income.*`) was dropped — every stream is income by construction; balance-
  readers are reconciliation rules, never streams.
- **`enabled(ctx)`** — the whole-stream on/off gate. Whole-stream gating is sound
  by commutativity (removing a summand can't perturb others).
- **`claims`** — the set of event **types** this stream owns
  (`("cm",)`, `("story",)`). Types are the bake's disjoint taxonomy
  (one per record, msgspec-guaranteed). The partition is asserted at registry
  construction — double-pay is a constructor-time impossibility.
  `ground.events` claims the **complement** of all claimed types.
- **`events(ctx)`** — the one verb. How a stream makes its events is private:
  **claimers** price the baked events they own; **synthesisers** mint events the
  bake doesn't carry (`dailies-<date>`, `visible: false`). Streams are
  mutually anonymous — no stream knows another exists.

**Shared rule — `GradedStamp` (N=2):** return claimed events priced by the
play-selected `reward_maps` row; `row(ctx, event)` is the sole varying part
(CM: fixed map key; stories: reads `event.era`). CM + stories today; PvP trio
(#61) are occupants 3–5.

**Shared rule — facet expansion:** compound shapes (`generator`/`sequence`) are
expanded by the **owning** stream into `visible: false` cadence children minted
under the parent key (`<parent-key>-<date>`), each carrying that day's payload.
Children inherit the parent's prefix and owner. The fold treats them as ordinary
one-day events; rushing moves only the parent's discrete face.

### Partition

Claims are **static** — a disabled stream's types do NOT fall back to
`ground.events`' complement. Gating drops events; it never re-routes them.

Synthesisers mint under reserved key prefixes (`dailies-`, `weekly-login-`,
`team-`, `shop-`, `club-`, `daily-`) that are fenced at construction (disjoint from baked first
tokens and each other).

Emission `source` = the event's stable key. One naming system: stream ids name
streams; stable keys name events and emissions.

### Coordinator

```
assert partition → union = settled world → one generic fold
  → P_income → reconcile(commitments) → P_final
```

The **settled world** is simultaneously the render source (lane cards =
`settledEvents()` where `visible`) and the fold input. "What am I rendering?"
is answered by construction — no secondary bundle.events join.

Money derivation exists **once**, in the fold: pay at `end`, at `start` when
rushed, `flatPayload` the rewards. Payment timing is unwritable in streams.

**The fold is linear:** `balance = base + Σ deltas`. No clamping, no
balance-conditionals — negative free carats are valid output. Linearity +
disjoint claims ⇒ streams commute; registry order means nothing.

### Reconciliation

There is no late *stream*. Reconciliation is **coordinator machinery**, the
third pipeline stage: `P_income → reconcile(commitments) → P_final`.

**Banners are just events — they have no spends.** A commitment is account
state the user raises against an event (a stable-key reference:
`commitments[key] = pity`). Three layers: event, claim (account state), debit
(derived emission). The referent event never knows about the claim.

Reconciliation iterates `ctx.commitments`, dereferences each referent in the
settled world (resolve-or-throw), and emits a debit. Loop over **claims
dereferencing events** — never over events checking for claims.

**Debit `source` = the claimed event's stable key.** Provenance is positional
(debits exist only in P_final's reconciliation tail), never a string on the row.

**Ordering: (start date, stable key) — deterministic.** Debits commute (linear
fold), so P_final is ordering-independent; ordering affects only claim seniority
in availability queries. Money is put aside at earmark (debit at `start`), paid
when due (measured at `end`).

`availableFor` is a query against P_income — income at the event's `end` minus
every earlier-by-start claim, self-excluding by construction.

### Read / write

The **projection is never written — only derived.** Account state (snapshot,
commitments, play, identity, subscriptions) is the write store. One write path:
`patch account state → persist → re-derive → notify`. Re-derivability, not
reversibility.

Bake immutable; the settled world lives one fold; never derive from a derived
world. `ctx` is frozen for a fold's duration.

---

## The public interface

### Construction

```ts
createCoordinator({
  bundle, config, gacha,   // the bake — frozen game data
  now, timeZone,           // the clock — day-bucket ingress
  store?,                  // account-state persistence (defaults localStorage)
  streams?,                // the registry; defaults to the full set, injectable for tests
}): Coordinator
```

The `streams` registry is a construction input, not a runtime surface. Partition
is asserted at build — an ill-formed registry fails to construct, not to fold.

### Value types

**`ResourceVector`** — keyed, signed integer vector (`free_carats`,
`paid_carats`, `trainee_tickets`, …). Per-dimension arithmetic; no scalar;
signed and allowed negative.

**Settled-world `Event`** — the render source:

```ts
interface Event {
  key: string;           // stable key — also the emission source
  type: string;          // trainee | support | cm | story | anniversary | holiday | …
  start: CalendarDate;
  end:   CalendarDate;
  rewards: ResourceVector;   // resolved face — stamped by the owning stream
  visible: boolean;          // false ⇒ ledger-only (minted cadence); off the lane
  // …name, art, every other baked display field rides along untouched
}
```

**`Projection`** — `{ ledger, series }`. `ledger` is the rich attributed fact
list; `series` is the dense O(1) `balanceAt` cache. Clients read **P_final** —
income with the reconciliation tail folded in.

### Write — typed mutators

```ts
commit(eventKey: string, pity: number): void   // raise/adjust a claim (0 clears)
setPlay(…): void                               // play-style sliders
setIdentity(…): void                           // club rank, trainer identity
setSubscriptions(…): void                      // daily pack date, training pass
saveSnapshot(…): void                          // the dated base reading
setRushed(eventKey: string, on: boolean): void // discrete payout to start
setFavourite(id: string, on: boolean): void    // view-only; no money effect
setEnabled(stream: string, on: boolean): void  // ephemeral dev toggle (never persisted)
```

All sugar over one private path: patch account state → persist → re-derive →
notify. `setEnabled` drops a stream from the next fold but is never persisted.

### Read

```ts
settledEvents(): readonly Event[]               // the settled world — the render source
projection(): Projection                        // P_final: ledger + balance series
balanceAt(date: CalendarDate): ResourceVector   // O(1) into the P_final series
availableFor(eventKey: string): ResourceVector | undefined  // pre-claim income at an event
document(): AccountState                        // persisted account state (read-only)
streams(): { id: string; enabled: boolean }[]   // dev-toggle state
recovered(): boolean                            // stored state was unreadable, started clean
```

`settledEvents()` is the render source — the same value that feeds the fold
feeds the lane. Cards read `rewards` straight off the event; no secondary
bundle.events lookups for reward amounts.

`availableFor` hits P_income, not P_final — a self-excluded P_final read would
wrongly deduct overlapping later-starting claims.

### Observe

```ts
subscribe(listener: () => void): () => void
```

Fired once after each recompute. **Reads never notify** — scrubbing `balanceAt`,
reading `settledEvents()` are broadcast-free. Returns an unsubscribe.

### What does not cross the boundary

- No DOM, no rendering — engine returns values; client paints them.
- No formatting — engine holds `-50`; sign/label/grouping = one formatter in
  the client.
- No axis / zoom / timezone-as-view / theme — day-bucketing needs a zone at
  ingress; which span is on screen is the client's.
- No clamping or affordability enforcement — negative free carats are valid
  output; the planner informs, the client shows a deficit.
- No reward-amount authorship — every number is baked; a game-data literal on
  the client side is a smell.

---

## The registry

13 pre-Eclipse producers → **22 streams + 2 shared rules + reconciliation**.

`selector.name` ids. **C** = claimer, **S** = synthesiser.

| id | kind | claims (types) / mints (prefixes) | `enabled(ctx)` | notes |
|---|---|---|---|---|
| `ground.events` | C | **complement** of all claimed types | always | catch-all for non-bankable records; pass-through + facet expansion; skips `pulls` (banner-scoped, never banked) |
| `event.anniversary-missions` | C | `anniversarymission` | always | passive baked event-income, pass-through + facet expansion |
| `event.factor-studies` | C | `factorstudies` | `play.factorStudies === "on"` | presence gate for minor-beat participation |
| `event.holidays` | C | `holiday` | always | passive baked event-income, pass-through + facet expansion |
| `event.legend-races` | C | `legendrace` | always | passive baked event-income, pass-through + facet expansion |
| `event.racing-carnival` | C | `racingcarnival` | `play.racingCarnival === "on"` | presence gate for minor-beat participation |
| `event.scenario-missions` | C | `scenariomission` | always | passive baked event-income, pass-through + facet expansion |
| `event.showtime` | C | `showtime` | `play.showtime === "on"` | presence gate for minor-beat participation |
| `event.skill-tests` | C | `skilltest` | always | passive baked event-income, pass-through + facet expansion |
| `event.trainee-debuts` | C | `trainee` | always | passive baked Original-debut story carats; banner `pulls` remain non-bankable |
| `event.missions` | C | `mission` | `play.missions === "on"` | presence gate — an off player's 161 grindy cards vanish |
| `play.champions-meeting` | C | `cm` | always | GradedStamp: face = `reward_maps` row at `play.championsMeeting`; `skip` ⇒ unpriced pass-through |
| `play.story` | C | `story` | always | GradedStamp: face = `reward_maps[story-<era>]` row at `play.storyEvents`; proto-era ⇒ unpriced |
| `subscription.training-pass` | C | `trainingpass` | always | GradedStamp, binary row: free track + premium row when subscribed |
| `play.dailies` | S | mints `dailies-` | `play.dailies === "on"` | daily cadence; payload from `reward_structures.dailies` |
| `play.weekly-login` | S | mints `weekly-login-` | `play.weeklyLogin === "on"` | daily cadence through the 7-login cycle from `reward_structures.weekly-login` |
| `play.team-trials` | S | mints `team-` | teamTrials set | Monday cadence; `reward_maps.team-trials` row by class-transition cycle |
| `play.shop-tickets` | S | mints `shop-` | bracket ≠ `none` | monthly 1st; bracket count IS the payload (engagement gating, not a baked rate) |
| `identity.club-rank` | S | mints `club-` | `clubRank !== null` | monthly 1st; `reward_maps.club-rank` row at rank |
| `subscription.daily-pack` | S | mints `daily-` | validity date set | 30-day cycle phased by validity date; `reward_structures.daily-carats` |

Reconciliation (not a stream): `ctx.commitments` → ordered debits, per above.

**Mint-prefix fence** — the six minted prefixes are pairwise disjoint and
disjoint from every baked first token (`anniversary`, `mission`, `cm`,
`factorstudies`, `holiday`, `leagueofheroes`, `legendrace`, `masterschallenge`,
`racingcarnival`, `scenario`, `showtime`, `skilltest`, `story`, `strongestteam`,
`banner`, `training`). Asserted at construction alongside claim disjointness.

### Enabled is PRESENCE, not pricing

A disabled claimer's events leave the settled world — off the ledger and off the
lane. Each stream chooses which lever fits:

- **Gate** (`enabled`) when opting out should remove the cards:
  `event.factor-studies`, `event.racing-carnival`, `event.showtime`, and
  `event.missions` — an opted-out player's minor beats vanish. This is the old
  `hiddenKinds` UI hack falling out of the model for free.
- **Face** (the row) when the cards must stay regardless of play: CM at `skip`,
  a proto-era story, an unsubscribed training pass — always-enabled, event
  renders with an unpriced/free-track face.

Disabled claims still hold their partition (types do NOT fall back to
`ground.events`' complement).

### Open

- **Child key convention** — `<parent>-<date>` (date-keyed reads better off the
  ledger); settled in TS, cosmetic.
