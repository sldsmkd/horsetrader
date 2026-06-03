---
name: project_projection_engine
description: Projection engine (frontend pillar 2) build progress + the spends/sequence block
metadata: 
  node_type: memory
  type: project
  originSessionId: 7e4492b9-a80e-45da-95be-519dda9cddf5
---

The projection engine (`horsetrader.site/js/src/core/projection/`) **core is complete and bootstrapped** as of 2026-06-01, all headless-tested (42 tests). **Next session = client UI** (no UI exists yet; `main.ts` only bootstraps the core into the build).

- **Built:** the pure fold `project(snapshot, streams) → {ledger, series}`; the rich attributed ledger + folds (`attribute`, `subtotals`, `balanceSeries` with cached `balanceAt`); three ground-truth channels — discrete **events**, recurring **generator** (`{start,payload,repeat}`), and **sequence** (`{start,resource,amounts:(int|null)[]}`, the baked daily-login shape; null=unpaid day; extracted by `sequencesFromBundle`). Shared reward vocab in `streams/rewards.ts`, UTC date arith in `projection/dates.ts`.
- **Bootstrapped:** entry is now `js/src/main.ts` (was `main.js`) — fetches `events.json`, builds the coordinator, exposes it on `globalThis.horsetrader`. No UI. This is what makes esbuild actually compile the core into `static/js/app.js`.
- **Scrub cache:** `balanceSeries` materialises the balance **densely** — a value for every calendar day across the extent — so `balanceAt` is flat **O(1)** dict lookup. No sparse change-points + binary search (decided 2026-06-01: just go dense, don't be clever with a swap-later). Exposes `dates` (change-points) + `extent`. Shared UTC date arith now at `projection/dates.ts` (used by ledger + generator + sequence).
- **Coordinator** (`core/coordinator/`): headless seam joining persistence↔projection. Loads plan, builds channels from bundle (`channels.ts` registry), folds enabled ones via `project()`, recomputes on input/toggle change. Surface: `update`/`setEnabled`/`projection`/`balanceAt`/`channels`/`recovered`; no DOM. **Toggles are ephemeral** (drop a channel from the fold, never persisted). Origin = snapshot date, else injected `now`. UI not wired yet (no UI exists).

**Next — spends/commitments channel (unblocked, pure frontend).** It's the *primary* user interaction but is **external logic, not the core fold** (the old prototype wrongly intermingled it). The ETL shipped the shared `SequenceReward` shape ([[project_sequence_reward_type]]) — the **sequence** channel above already ingests its baked income form, so the shape exists. What remains is client-owned: a **collection of spend strategies the client generates** in the sequence shape (negative deltas) + overlay + **affordability** (spend deltas depend on the *running balance*, so this channel consumes the fold's own output — not a clean `(date,deltas)` producer). Coordinator+toggles now DONE, so spends is the next slice: it slots into the coordinator recompute as a **second phase after** the ground-truth fold, not as another `channels.ts` registry entry.

**Spends design settled in discussion (2026-06-01), not yet built:** persist only the *commitment intent* (`{bannerId: amount}`, already in persistence); **derive** strategy/sequences every recompute from intent + running balance, never persist the resolution — this kills the old "plans rely on state that no longer exists" pain (no stored resolution to go stale). When a downstream plan can't afford its intent, **let the balance go negative** — deficit is valid output, never back-propagate feasibility (the old reservation/last-day-catch tangle). Resolution is sequential in a stable order; **comparator is an OPEN exploration, leaning: order by banner `end`, banner id as tie-breaker** (banners aren't fixed-length, so end = real deadline; id alone is deadline-blind).

**Why:** records the current frontier + the architectural correction (spends are external/ETL-sequence-driven, never intermingled into the fold).

**How to apply:** full detail lives in `docs/frontend/projection.md` (Implementation status) — read it before resuming. Engine is done (fold + 3 channels + dense O(1) cache + coordinator + toggles + bootstrap). **Resume point: the client UI** — bundle loader/DOM driving the coordinator surface, and the spends/commitments channel (the post-fold second phase; design settled above, just not built). JST-as-"today" was considered and dropped (a one-day origin slop is immaterial; snapshot date is the real anchor). See [[project_site_consumer_workspace]], [[project_output_breaking_allowed]].
