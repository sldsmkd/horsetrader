# Unity — cloud save

Status: **shipped (2026-06-19); graduated out of the beta chamber into the main
app.**

> Codename **Unity**, after the in-game *Aoharu Hai — Unity Cup: Shine on Team
> Spirit!*. Thesis: **working together** — one account, one save, coherent across
> devices. Local and cloud *working together*, not cloud replacing local.

The first arc that **added a capability** rather than re-architecting a subsystem
(cf. Eclipse = economy engine, Trackblazer = renderer). It spans both halves of the
monorepo and stood up the project's **first server**.

Where things live now:

- [frontend/cloud-sync.md](../../frontend/cloud-sync.md) — the living sync
  semantics: every single-client state and its action, conflict resolution.
- [frontend/persistence.md](../../frontend/persistence.md) — the `{ local, remote }`
  envelope; `remote` is exactly the blob that syncs.
- [`horsetrader.cloud/`](../../../horsetrader.cloud/README.md) — the Worker
  (`unity-sync`: endpoints, secrets, deploy) and the supporter admin tool.
- [design.md](design.md) — the original design with rationale, annotated where the
  build diverged. [appendix.md](appendix.md) — the pricing and user-base research
  behind the $0 keystone.

## The goal

A player using the planner on phone and desktop sees **one save**: sign in once per
device and the plan built anywhere shows up everywhere, without export/import.

## Three ideas that hold it together

1. **Steam Cloud, local-first.** localStorage stays the synchronous working copy
   (offline and signed-out are unchanged); the cloud is a synced mirror reconciled
   at session boundaries. Conflict is a first-class, rare event resolved by
   **pick-a-side**, never a silent overwrite.
2. **The trust-model flip.** A server, external comms, other users' data and
   secrets arrived together, bringing a real **security obligation** — scoped to
   the cloud surface only (not the Python ETL).
3. **$0 is the keystone.** A server was allowed only because it stays inside the
   free tiers (binding limit: Workers 100k requests/day). That makes frugality a
   design driver — it shaped the sync cadence.

Postures that recur: **the cloud holds plans, not people**, and **spend the
dependency budget precisely**.

## Decisions as built

| Area | Decision |
| --- | --- |
| **Spine** | Local-first; the synchronous `KeyValueStore` stays synchronous, the async cloud layer (`core/cloud/`) sits beside it. |
| **Platform** | Cloudflare: one Worker (`unity-sync`) + a **private R2 bucket** (`env.BUCKET`), never browser-facing. |
| **Sync clock** | One R2 object per account (`provider:sub`); the **object ETag is the rev**; pushes are conditional (`If-None-Match: *` create, `If-Match` fast-forward); `412` = conflict. The rev rides the response **body** — a CDN weakens the `ETag` header. |
| **Transport** | The whole serialised `PlanDocument` (~1 KB gzipped). No delta, no merge. |
| **Auth** | Direct OAuth2 auth-code to **Google** (OIDC, `id_token` verified with `jose`) and **Discord**; a stateless HMAC-signed cookie session holding `{ provider, sub }` only. One provider at a time, no account linking — "use the same sign-in everywhere". Steam deferred. |
| **Conflict** | Detect = cloud moved AND local dirty; pick-a-side dialog showing value facts (name, commitment/favourite/rushed counts, snapshot). See [cloud-sync.md](../../frontend/cloud-sync.md). |
| **Cadence** | User-initiated **Sync** + one bounded **reconcile on load** ("free credit"); client egress throttled to one sync per 5s. Not push-on-close. |
| **Disconnect** | Deletes the cloud save (`DELETE /api/sync`, confirm first); the local copy stays. |
| **PII** | Trainer ID deleted. The trainer name **syncs** with the plan (a name reappearing on a second device is the "sync worked" signal). No account PII in the blob. |
| **Defence in depth** | Client: `assertPlausiblePlan` before every push. Worker: size cap (413) then a bounded "looks like a plan" sniff (422) — sanity, not a schema. |
| **Deps** | The "no external deps" rule broke once, under audit: **`jose`** only. HMAC signing is Web Crypto; the OAuth calls are plain `fetch`. Security stage (audit, SAST, gitleaks) covers the cloud surface. |
| **Supporters** | Server-authoritative: an entitlements object in R2, edited with `horsetrader.cloud/tools/supporters.py`; the Worker stamps `plan.supporter` on pull and strips it on push; the client never persists it. Gates the beta chamber. |

## How it rolled out

1. Designed end-to-end at altitude (2026-06-18).
2. Prototyped in the **beta chamber** — the in-app isolation membrane for
   unproven code — while the R2 CAS and OAuth round-trip were proven in
   production (2026-06-19).
3. Graduated: Cloud Save now lives on the Trainer page, the conflict dialog is an
   app-level modal raised from both the load reconcile and the Sync button, and the
   chamber was handed over to supporter-only WIP (UmaMark, the onboarding knob).
4. Debut branded the provider buttons (real Google/Discord marks).

## Reversed or dropped along the way

- **Username local-only** (`local.username`) → reversed; the name syncs. A
  migration folds any legacy `local.username` back into the plan.
- **`@badgateway/oauth2-client`** → not needed; auth-code is a few `fetch` calls.
- **Feature-gating "descoped to Patreon"** → a server-side supporter allowlist
  landed instead (the design's own requirement: no client-distributable hashes).
  Patreon remains the intended future source of truth and funding.
- **A one-shot `?unity=connected` marker** → gone; every load reconciles, so the
  first-auth migration rides the post-redirect reload.

## Still open

- Steam auth (OpenID 2.0, paid-partner friction).
- Patreon integration (entitlements + cost funding).
- Conflict-dialog polish: device labels and a real plan modified-time.
- Loose ends never needed so far: an offline edit queue, multi-tab coordination
  (BroadcastChannel), account data export.
