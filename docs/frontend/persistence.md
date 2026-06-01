# Persistence (pillar 1)

Persistence stores the user's inputs and **nothing derived**. It is pure
`core/`, headless, and knows nothing about the UI. Pair with
[projection.md](projection.md), which consumes what this stores.

> Status: design, not yet implemented. Field-level schema is deliberately *not*
> specified here — it's settled at build time. This doc is the principles.

## The governing principle: persist inputs, derive the rest

What the user typed is a *fact* and gets stored. Everything visible — the
per-banner totals, the forward resource curve, the minimap line — is *derived*
and is **never** persisted. Storing a derived value would be a denormalisation
smell and a migration burden. The old prototype already got this right: it
persisted a snapshot, config, spends, and favourites, but none of the computed
planner-table numbers.

## What gets stored: four sections by lifecycle

The inputs split into four sections with genuinely different lifecycles — which
is why a flat bag of keys (the old shape) felt wrong:

1. **Snapshot** — a *dated* point-in-time reading of resources (carats free/paid,
   tickets, shards, …). The origin point projections run forward from.
2. **Configuration** — slow-changing account settings (ranks, daily pack,
   weekly-login pattern, monthly flags, whale toggle, display prefs).
3. **Commitments** — per-banner planned spend / pulls. Keyed by banner id.
4. **Favourites** — the set of entities (supports / trainees) the user marked
   interesting, with an optional note.

## Principles

### One thin storage module — synchronous, simple

Nothing in the app reaches for `localStorage` directly; it all goes through a
single small storage module, so exactly one place knows the storage mechanism.
That's a **cleanliness boundary, not a pluggable-backend abstraction** — it stays
**synchronous and simple**. We considered an async interface to keep a future
IndexedDB swap painless, but the sizing below confirms localStorage is comfortably
sufficient, so that ceremony isn't worth paying. If a backend swap ever becomes
real, this single module is the one place to change.

### Sizing — localStorage is never in danger

| Component | Per-item | Ceiling count | Ceiling |
| --- | --- | --- | --- |
| **Favourites** (academy entities, may carry a note) | 512 B | ~2,048 — current ~950 (157 chars / 539 supports / 256 trainees) + ~5 yr growth (~190/yr → ~1,900) | ~1 MB |
| **Commitments** (events/banners, no notes — just an amount) | 128 B | ~1,000 — ~half of the current ~480 events, ×4 for growth | ~125 KB |
| **Config + snapshot** | — | — | ~2 KB |
| **Total** | | | **~1.1 MB** |

~1.1 MB ceiling against localStorage's ~5 MB limit is a **~4.5× margin**, and
realistic usage (≈100 noted favourites; most favourites are note-less ~15–30 B
keys) is **well under 200 KB**. **IndexedDB is not needed.**

### A versioned, migratable document

The persisted document carries a top-level `version`. Reading it is a *pipeline*,
not a bare `JSON.parse`:

```
read() → parse (guarded) → validate known shape
       → if version < CURRENT, run ordered migrations v(n) → v(n+1) …
       → validate result is current shape → hand over
```

Migrations are pure `(old) => new` functions in an ordered chain. The version
field is what lets us evolve the shape **in situ** without discarding what the
user saved.

### Never lose the user's data — fail soft

The plan is local-only with no backup. On any read/parse/migrate failure:
**preserve and degrade** — stash the raw blob under a backup key, start clean,
and surface a visible "couldn't read your saved plan" notice. Never `throw` into
a blank app; never silently discard their intent.

### Validate at ingress — for integrity, not security

This *is* the untrusted-input boundary (see
[trust-and-failure.md](trust-and-failure.md)). But it is a single-user,
local-only planner — no servers, nothing secret. Validation here means *malformed
or stale input can't brick their own save or break the app*, not threat defence.
Validate shape and type, degrade gracefully, and **don't gold-plate it**.

### Tight, but not at the cost of clarity

The user cares about compact structures, and the 5 MB budget rewards it:

- **Keyed maps, not arrays** — `{ [bannerId]: … }`, no repeated id field, O(1)
  lookup.
- **Sparse** — omit empty fields; drop an entry entirely when it carries nothing
  (the old shape stored `{"note":""}` for every favourite — don't).
- Start with **on-disk shape == in-memory shape** plus the tightness above.
  Packing it tighter (short keys, a serialize boundary) is a *future migration*,
  not day-one complexity — the versioning machinery makes it safe later.

### Headless and isolated

This layer reads and writes a document, full stop. It knows nothing about UI or
about the projection engine. Wiring it to state (e.g. a debounced autosave on
change) is a thin coordinator's job — `coordinator → persistence`,
`coordinator → state`, neither of those two aware of the other.

## Notes

- **Keys reference ETL stable entity ids** (e.g. `30107`, `108301`). Those keys
  are stable by construction (monotonic sequence, or pinned to in-game data
  unchanged for years), so there is **no orphan handling** to worry about.
- **The old prototype's shape is a checklist of anti-patterns**, useful as a
  reference for *what* to store, not *how*:

  | Old prototype | Principle it violated |
  | --- | --- |
  | Scattered flat `ht_*` keys, direct `localStorage` access | one narrow seam / single document |
  | No `version` field | versioned, migratable artifact |
  | Double-encoded JSON strings as values | serialize once at the boundary |
  | `30096-banner` vs `support:30107-maruzensky` | one consistent key scheme |
  | `{"note":""}` stored for every favourite | sparse / omit-empty |
