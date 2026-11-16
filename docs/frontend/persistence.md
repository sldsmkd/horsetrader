# Persistence (pillar 1)

Persistence stores the user's inputs and **nothing derived**. It is pure
`core/`, headless, and knows nothing about the UI. Pair with
[projection.md](projection.md), which consumes what this stores.

> Status: built under `core/persistence/` and headless-tested (`npm test`) —
> the document, storage module, and validation/recovery. Field-level schema is
> deliberately *not* specified here — it's settled in code. This doc is the
> principles.

## The governing principle: persist inputs, derive the rest

What the user typed is a *fact* and gets stored. Everything visible — the
per-banner totals, the forward resource curve, the minimap line — is *derived*
and is **never** persisted. Storing a derived value would be a denormalisation
smell and a migration burden. The old prototype already got this right: it
persisted a snapshot, config, spends, and favourites, but none of the computed
planner-table numbers.

## What gets stored: sections by lifecycle

The inputs split into sections with genuinely different lifecycles — which is why
a flat bag of keys (the old shape) felt wrong. All are optional and sparse; a
fresh user's document is just `{ version }`.

1. **Snapshot** — a *dated* point-in-time reading of resources (free/paid carats,
   tickets, shards, …). The origin point projections run forward from.
2. **Configuration** — slow-changing account/forecast inputs (play style and its
   settings, club, daily pack, monthly flags, participation scales). Also home to
   small synced app marks such as the onboarding `firstrun` watermark
   ([menu.md](menu.md#first-run-tazunas-tour)).
3. **Commitments** — per-banner committed **pities** (the unit of account; the
   carat cost is *derived*, never stored — see [projection.md](projection.md)).
   Keyed by banner id. A bare integer, or `{ number, use_paid }` only when the
   player opted in to spending paid carats at full price on that banner.
4. **Favourites** — the set of atoms (supports / trainees) the player still wants.
   A bare marker: the key's presence is the fact.
5. **Rushed** — below-lane events the player has already finished, keyed by event
   id → the UTC instant they ticked it (an action timestamp, not a timeline date).
6. **Notes** — the player's free-text *why*, keyed by subject id (an atom or a
   banner). An orthogonal layer: a note never implies a favourite or a commitment,
   and it outlives both. Normalised at ingress (`normaliseNote`: trim, 140 code
   points, strip control characters except newline) and always rendered as text,
   never markup. (Added in v3, which folded the old unused `FavouriteEntry.note`
   into this map — [Twinkle Monthly](../projects/twinkle-monthly/README.md).)

Presentation **Settings** are a separate bucket if/when they need persistence:
theme, animation preference, and similar UI behavior. They do not feed
projection and should not be filed under account Configuration.

## The on-disk envelope: `{ local, remote }`

The stored artifact wraps the plan in a thin envelope that separates **what
syncs** from **what never leaves the device**:

```
{ local: { sync?: { etag, dirty } }, remote: <the versioned PlanDocument> }
```

- **`remote`** is the versioned `PlanDocument` above — the migratable unit, and
  the *exact* blob cloud sync GET/PUTs ([cloud-sync.md](cloud-sync.md)). It
  includes the trainer's display name (`config.identity.trainerName`): a name that
  reappears on a second device is the human-legible "sync worked" signal. The
  coordinator, projection, and every downstream consumer read `remote` as "the
  plan"; the envelope is invisible to them (`coordinator.document()` returns it).
- **`local`** holds never-synced device state: only the sync bookkeeping (the
  last-synced ETag and the `dirty` flag), which is meaningless on another device.

This **structural** split is what makes cloud sync simple: there is exactly one
thing to sync (`remote`), with no per-push masking or allowlist. The cloud holds
*what you're planning* and the handle you chose — never account identity (email,
provider id stay with the OAuth provider and the session). The seam lives only at
the persistence boundary (`core/persistence/index.ts` `load`/`save`).

> History: the old 12-digit **Trainer ID** (a feature-gating hook) was deleted by
> the `v1 → v2` migration. For a brief period the display name was kept
> device-local in `local.username`; that was reversed, and `load` folds any legacy
> `local.username` back into `remote`. Feature gating is server-side now — the
> Worker stamps a supporter flag onto the pulled plan
> ([Unity](../projects/unity/README.md)); the client never persists it.

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
| **Favourites** (bare atom-id markers) | 64 B | ~2,048 — current ~950 (157 chars / 539 supports / 256 trainees) + ~5 yr growth (~190/yr → ~1,900) | ~1 MB |
| **Commitments** (banner id → pity) | 128 B | ~1,000 — ~half of the current ~480 events, ×4 for growth | ~125 KB |
| **Notes** (subject id → ≤140 code points) | ~600 B worst case (UTF-8) | ~1,000 — the pathological "note everything" case | ~600 KB |
| **Config + snapshot + rushed** | — | — | ~10 KB |
| **Total** | | | **~0.9 MB** |

A ~0.9 MB pathological ceiling against localStorage's ~5 MB limit is a **>5×
margin**; realistic usage (a few hundred favourites, dozens of notes) is **well
under 100 KB**. **IndexedDB is not needed.**

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

localStorage is the primary copy (cloud sync is optional, and a signed-out player
has no other backup). On any read/parse/migrate failure:
**preserve and degrade** — stash the raw blob under a backup key, start clean,
and surface a visible "couldn't read your saved plan" notice. Never `throw` into
a blank app; never silently discard their intent.

### Validate at ingress — for integrity, not security

This *is* the untrusted-input boundary (see
[trust-and-failure.md](trust-and-failure.md)). But the plan is single-user data
with nothing secret in it — the cloud copy is the same blob, identity-anonymous. Validation here means *malformed
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

### Beyond the plan: serialise, share, and app-meta

The plan document is the localStorage state, but the UI ([ui.md](ui.md)) raises
three further consumers of the **same serialise boundary** — captured here so the
seam is designed once, not three times:

- **JSON export / import** *(not built)* — dump the persisted state as JSON for
  support diagnosis and restore it. Cloud save now covers the backup role for
  signed-in players; export remains the signed-out safety net if it lands.
- **A URL-serialised shareable plan** *(not built — "To Press" in
  [desk.md](../projects/twinkle-monthly/desk.md))* — commitments + favourites
  encoded into a link (the growth loop's clickable channel). The URL is the
  transport, so it needs no account. Same serialise machinery.
- **App-meta** — small app-tracked values that are **not** plan input (e.g. the
  what's-new "last seen version"). Kept **distinct from the input sections**
  and outside the migratable plan shape — its natural home is the envelope's
  `local` tree (beside the sync metadata), since none of it should ride to the
  cloud.

The exception is a mark that is about the *person*, not the device: the
onboarding `firstrun` watermark lives in `remote.config` precisely so a second
device doesn't replay the tour.

A shared link is **untrusted ingress** — a pasted/shared URL is user-controlled,
so it is validated like any other user input (see
[trust-and-failure.md](trust-and-failure.md)), never blind-cast.

## Notes

- **Keys reference ETL stable ids** (the prefixed `support-…` / `trainee-…`
  entity ids and event keys). Those keys
  are stable by construction (see [../contract.md](../contract.md) for the
  `support-<id>-<slug>` / `trainee-<id>-<slug>` vocabulary), so there is **no
  orphan handling** to worry about.
- **The old prototype's shape is a checklist of anti-patterns**, useful as a
  reference for *what* to store, not *how*:

  | Old prototype | Principle it violated |
  | --- | --- |
  | Scattered flat `ht_*` keys, direct `localStorage` access | one narrow seam / single document |
  | No `version` field | versioned, migratable artifact |
  | Double-encoded JSON strings as values | serialize once at the boundary |
  | `30096-banner` vs `support:30107-maruzensky` | one consistent key scheme |
  | `{"note":""}` stored for every favourite | sparse / omit-empty |
