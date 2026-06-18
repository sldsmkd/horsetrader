# Unity — sync resolution (single client)

The detail under `design.md §5` (Sync triggers + conflict), scoped to **one
client performing one sync action**. §5 fixes the high-level rule — *conflict =
cloud moved AND local dirty; everything else is a no-op, a fast-forward, or a
normal push* — and defers the row-by-row "which-is-right" logic to the weeds.
This is the weeds: every reachable state of a single client, reasoned to its
correct action, so the pull guard and the push skip have a settled table to
implement against. Transport is `design.md §3` (R2 + ETag CAS) and `§4` (the
`{ local, remote }` save unit); resolution *mechanism* (the pick-a-side dialog,
its metadata) stays deferred — this settles *when* it fires, not how it looks.

## The only inputs

A single client's sync decision reads exactly four things:

- **local content** — `∅` (fresh/empty plan) or **populated**.
- **`dirty`** — has `remote` changed since the last successful sync. Durable
  (persisted in `local.sync`), survives reload.
- **held base** (`lastSyncedEtag`) — `ø` (never synced) or `E` (a known rev).
  The CAS base for the next push.
- **cloud** — learned *only by doing the GET*: `∅` (404) or **present@etag**,
  with that etag `== base` (cloud unchanged since we synced) or `≠ base` (moved).

The client never knows the cloud etag without pulling. So a pull is always
**GET-then-decide**: fetch, compare, *then* adopt or refuse — never adopt-blind.

## Read first: the null-base subtlety

`dirty` means "local differs from the content at `lastSyncedEtag`." When the base
is `ø` there is **no synced baseline to be clean against** — so a *populated*
local plan with a null base is **logically dirty**, whatever the persisted flag
says (a fresh-empty plan is the only legitimately-clean null-base state).

This is the hinge that makes the §5 migration matrix fall out of the same table
instead of being a hand-coded special case: "both populated → conflict on first
link" is just **populated-local (∴ dirty) + base ø + cloud present** landing in
the conflict row, rather than being mistaken for a silent fast-forward.

> **Rule:** treat `base ø + populated local` as dirty. Only `base ø + local ∅`
> is fast-forwardable.

## Pull (GET → decide → adopt last)

| # | dirty? | cloud | etag vs base | action |
|---|--------|-------|--------------|--------|
| **P1** | clean | `∅` | — | **no-op.** Nothing up there; keep local. |
| **P2** | clean | present | `== base` | **no-op.** Already current — idempotent. |
| **P3** | clean | present | `≠ base` *(incl. `base ø + local ∅`)* | **fast-forward.** Cloud advanced while we sat clean; adopt silently. The legit "pull down" / migration-row-3 case. |
| **P4** | dirty | `∅` | — | **block → push.** You have edits the cloud has never seen; pulling would discard them *into nothing*. Offer Push. |
| **P5** | dirty | present | `== base` | **block → push.** Cloud is unchanged; pulling re-adopts the very base you edited from — pure, pointless loss. Offer Push. |
| **P6** | dirty | present | `≠ base` *(incl. `base ø + populated`)* | **CONFLICT.** Both diverged. Pick-a-side; never silently clobber. The spiciest case, and the one first-link migration hits. |

Reasoning thread: the data-loss predicate for a pull is **`dirty` alone** (P4/P5/P6
all lose edits if they adopt blindly). The cloud comparison doesn't gate the
guard — it *grades* it: P4/P5 are recoverable by pushing (cloud hasn't moved, a
clean push will land), P6 is a genuine fork that needs a human choice.

## Push (conditional PUT — CAS does the arbitration)

`base ø` → `If-None-Match: *` (create-only); `base E` → `If-Match: E`
(fast-forward-only). We never clobber unconditionally.

| # | dirty? | base | cloud | sends | server | action |
|---|--------|------|-------|-------|--------|--------|
| **U0** | clean | any | — | — | — | **skip.** Nothing to push; spending a Worker request on a no-op violates the $0 keystone (§10). |
| **U1** | dirty | `ø` | `∅` | `INM:*` | 200 | **created.** `markSynced(newEtag)`, clear dirty. (Migration "push up".) |
| **U2** | dirty | `ø` | present | `INM:*` | **412** | **conflict.** Something exists where we expected emptiness — another device created it; first-link both-populated. → P6 dialog. |
| **U3** | dirty | `E` | `== E` | `IM:E` | 200 | **fast-forward.** `markSynced(newEtag)`. The happy mid-session save. |
| **U4** | dirty | `E` | `≠ E` | `IM:E` | **412** | **conflict.** Cloud moved under us. → P6 dialog. |
| **U5** | dirty | `E` | `∅` (deleted) | `IM:E` | **412** | **conflict (vanished base).** Our base no longer exists; treat as a fork, don't blind-recreate. → P6 dialog. |

The CAS is the whole point: the client doesn't pre-check the cloud etag for a
push — it *asserts* its expected base in the conditional and lets R2's HTTP
matcher arbitrate. A 412 is the server saying "your base is stale," surfaced as
data, not a throw (see `client.ts` `pushSave`).

## Where the guarded rows terminate

P4/P5 are not conflicts — they're "you meant to push": resolve by offering the
Push action, no dialog. P6 / U2 / U4 / U5 are the real fork, and resolve
**pick-a-side** (§5, Steam-style — merge stays off the table):

- **Keep local** → force-push (`cloud/sync.ts` `keepLocal`): push local over the
  cloud's *current* etag (the one fetched during detection), local wins.
- **Take cloud** → force-pull (`keepCloud`): adopt the cloud plan, discard local.

BUILT (in the beta chamber): `syncNow` detects the fork (dirty push → 412 → GET the
cloud side) and returns a `conflict` carrying both sides' **value-summary facts**
(trainer name, banner/favourite/rushed counts, snapshot date+carats — our answer to
Steam's "modified at", which we lack a plan-level timestamp for). The Steam-style
**`cloudConflictDialog`** (`ui/views/cloudConflict.ts`) presents the two, requires a
conscious pick (Continue disabled until chosen — no one-click clobber), shows a live
consequence line, and calls `keepLocal`/`keepCloud`. Deferred polish: device labels,
a real plan-mtime, and graduating the dialog from the chamber to an app-level modal.

## Why pick-a-side, and not a merge (closed)

This is the **Steam-Cloud model**, and it's where the design settled originally —
not a fallback we backed into. The recurring temptation is to make conflict
*disappear* by treating saves as deltas (a commit stream / op-log) or by
auto-merging the document field-by-field. Both are rejected, on **workload, not
cleverness**:

- **Op-log / commit stream — wrong workload.** Commit logs and CRDTs earn their
  complexity under concurrent *multi-writer* load, where silently merging disjoint
  edits *is* the product. Unity is **one human, occasionally on a second device**,
  ~1–2 KB of plan. They also fight `§3`/`§10`: R2 has no append primitive, so a log
  is either one-object-per-commit (request fan-out vs the 100k/day cap, plus
  compaction) or a growing object you rewrite (back to whole-object CAS, *plus*
  client-side replay). And we already chose snapshot-not-log for persistence one
  layer down (`document.ts`: inputs as current-state maps, not op streams).
- **Field-merge — worst of both worlds.** A typed structural merge takes on the
  *cost* of the merge world (per-field LWW, the snapshot scalar still forks) and
  adds a new one — it's hand-coded against today's document shape, so it breaks on
  every schema change — while getting **none** of the op-log's generality. More
  machinery than pick-a-side, less principled than a log, and it *still* doesn't
  eliminate conflict.

So when both sides diverged, **the user picks a side. That's it.** It isn't a
compromise — for low-conflict single-writer data it's the *correct* endpoint, and
it beats silent last-writer-wins precisely because LWW's loss is invisible:
stale-device LWW would nuke the other device's edits with no trace, whereas a
pick-a-side prompt with real metadata (banner count, snapshot date, device, when)
is *clearer* than any merge the user can't inspect. One blob, one CAS, one dialog.

## Delta vs. today's code

- **Push** already implements U1–U5 correctly (conditional PUT, 412-as-data). Only
  **U0** is missing — a manual push while clean should skip rather than spend a
  request (cheap nicety; the button can still force).
- **Load-time auto-pull** (`cloud/sync.ts` `pullOnLoad`, fired from `app.ts`, design
  §5 trigger 1) does GET-and-compare: clean + cloud-moved → fast-forward (P3); **dirty
  + cloud-moved → CONFLICT, dialog raised right on load** (the fork is no longer
  discovered only on a manual Sync); cloud∅/unchanged/local-only-edits → no-op. Never
  auto-pushes (push cadence stays user-initiated, §10). Non-blocking + fail-soft: a
  signed-out 401 or network failure falls through to local. This is Unity's first
  behaviour on the main (non-beta) load path.
- **Manual reconcile** (`syncNow`, the beta Sync button) implements the full table:
  clean → fast-forward; dirty → conditional push (CAS), and a 412 (P6) → fetch the
  cloud side and raise the **pick-a-side dialog**. The grading P4/P5-vs-P6 falls out:
  a clean push succeeds (no dialog); only a 412 forks.
- **Resolution** (`keepCloud`/`keepLocal` + `ui/views/cloudConflict.ts`
  `presentCloudConflict`) is the shared mounting + pick-a-side glue both paths call.
