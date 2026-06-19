# Unity — design

The detailed design, distilled from the capture session (2026-06-18). For goals,
scope, and the decisions-at-a-glance see [unity.md](unity.md) (framing). Findings
that *back* these decisions are in the appendices at the foot.

---

## 1. Spine — local-first, Steam-Cloud sync

**Mental model: Steam Cloud for the plan document.** Reason about it with Steam's
exact mechanics — they're well-understood and battle-tested:
- **Local is the working copy.** The app reads/writes localStorage exactly as today —
  synchronous, offline, zero-account. Nothing regresses for a signed-out user.
- **Cloud is a synced mirror, keyed by identity.** On a sync event the local copy is
  reconciled against the cloud copy.
- **Sync rides session boundaries**, not keystrokes (pull on open/sign-in; push
  cadence — see §5). The cloud is never in the hot path of editing.
- **Conflict is a first-class, rare event** — when local *and* cloud both advanced
  since the last common point, surface a choice; never silently pick a winner.

**Local-first is the spine.** The bedrock persistence
([persistence.md](../docs/frontend/persistence.md)) got right — synchronous single
storage module, "no async ceremony" — stays untouched. Cloud sync is a **new layer
beside it**, async by nature, that never forces the local store async.

**Seams already designed for this** (build *into* them):
- **The single storage module is the named swap point**
  ([storage.ts](../horsetrader.site/js/src/core/persistence/storage.ts)). Its
  `KeyValueStore` is **synchronous** — fine: local stays the sync store, the async
  cloud layer sits *above* it. We do **not** async-ify `KeyValueStore`.
- **The serialise boundary is the transport unit.** The serialised `PlanDocument` is
  the save file that travels to the cloud — a third consumer (after export/import +
  URL-share) of one serialise seam, designed once.

---

## 2. The trust-model flip — Unity's defining change

[trust-and-failure.md](../docs/frontend/trust-and-failure.md) explicitly parks this:
*"…no servers, no external comms, no other users' data, nothing secret… (If servers,
sync, or sharing ever land, revisit this.)"* **Unity is that moment.** Every clause
flips: a **server** (first), **external comms** (auth + sync), **other users' data**
(isolation is now a real boundary), something **secret** (auth tokens/sessions).

So Unity carries a genuine **security obligation** the rest of the app was correctly
exempt from. The cloud endpoint is untrusted ingress *for real* — this is the one
place in the codebase where threat-modelling is warranted; the rest of the trust doc
still holds.

**Security stage in the pipeline (NEW).** The flip reaches the build: add dependency
scanning (audit/CVE), secret scanning, SAST as pipeline stages
([[project_build_pipeline]] gains a security stage). **Scope: the cloud/Worker
(JS/TS) surface ONLY — NOT the Python ETL** (single-dev, local, no external audience;
"if an ETL dep roots my own box, that's on me"). Harden the new public boundary;
don't retrofit the monorepo.

---

## 3. Storage — R2 + the ETag as the sync clock

**Substrate: R2** (Cloudflare's S3). One object per account = the serialised plan
blob. (Rejected alternatives: Durable Object — needs Workers-Paid + 128 KiB value
cap; D1 — conflict logic in app code; KV — eventually-consistent, no CAS. R2 kills
all three concerns: huge cheap objects + native conditional writes.)

**The sync mechanism is optimistic concurrency = `git push` accept/reject**, and R2
gives it for free via ETags + conditional writes. **The object's ETag IS the rev** —
no hand-rolled counter, no DO, no SQL.
- **pull** = `GET` → keep `{ doc, etag }`; store `etag` as `lastSyncedEtag`.
- **push** = `PUT … onlyIf: { etagMatches: lastSyncedEtag }` (`If-Match`). Succeeds →
  fast-forward, keep new ETag. **Precondition-failed (412) → someone moved it =
  conflict** → dialog.
- **first-ever write** = `PUT … onlyIf: { etagDoesNotMatch: "*" }` (`If-None-Match:
  *`) so we never clobber an existing cloud save.
- Local persists `lastSyncedEtag` + a `dirty` flag (app-meta, not plan input —
  persistence.md already carved out the app-meta bucket). `dirty && push-rejected` →
  conflict.

**The Worker mediates BOTH directions — R2 is never browser-facing.**
- Reads are private per-user → must be authorized → only the Worker can. **R2 is NOT
  publicly readable** (no public bucket/domain); it's a **Worker binding
  (`env.BUCKET`)**. The browser only hits Worker endpoints (`GET`/`PUT /api/sync`)
  and has no R2 URL.
- No bypass: presigned-GET/direct-R2 exists to offload *big* payloads; our save is
  ~1–2 KB so proxying is free and presigning would only *add* a round-trip.
- Symmetric: pull `GET` → auth → read → return body + ETag; push `PUT` → auth →
  conditional write. Thin authenticated proxy over a **private** bucket; R2
  credentials never leave the Worker.

> **VERIFIED (2026-06-19, in production):** R2 `onlyIf` conditional writes work as
> designed — `If-None-Match: *` first-write and `If-Match: <etag>` fast-forward both
> CAS correctly, a failed precondition returns no result (→ our `412`). One gotcha
> surfaced and is handled: a CDN weakens the response `ETag` header to `W/"…"`, so the
> rev rides the response **body** instead ([[etag_in_body_not_header]], sync.ts). R2 +
> Workers free-tier limits hold at the modelled scale (appendix.md); a manual Sync is one
> request, and load spends at most one reconcile (the bounded free-credit, §5).

---

## 4. The save / transport unit

A real engaged save measures **2,426 bytes raw / 1,022 gzipped** (25 commitments, 35
favourites — see [appendix.md](appendix.md) §A). Consequences:
- **Push the whole blob every sync. No delta-sync, no chunking, no patch protocol.**
  At ~1 KB the document is smaller than the HTTP headers around it; diff/merge
  cleverness costs more than it saves. Dumb whole-object PUT/GET — which is exactly
  what the ETag CAS wants.
- **Wire compression optional** (~2.4×) and not worth bothering at this size.
- **The blob is literally the existing serialised `PlanDocument`** (version + four
  sections). Nothing new to design for the transport unit.
- **Size cap = anti-forgery only.** The local copy lives in localStorage (~5 MB cap),
  so a legitimate client *physically cannot* push more than ~5 MB; real saves sit
  ~2,000× under that. The ~1 MB pathological ceiling is unreachable — don't engineer
  for it. A one-`if` Worker reject above ~5 MB is cheap wallet-insurance against a
  hand-crafted request that bypasses the local store; it never touches a real user.

**No local-only exception — the whole blob syncs, display name included** (reversed
2026-06-18). Earlier drafts masked the username (`config.identity.trainerName`) out
of the cloud copy for PII-minimisation (strip-on-push / re-decorate-on-pull, or a
local-only-keys allowlist). That's gone: the display name **syncs with the plan**. A
name that reappears on a second device is the human-legible "sync worked" signal,
and an invisible-username sync is confusing. So there is no mask, no allowlist, no
per-key dent in whole-blob-push — the cloud blob is *exactly* the serialised
`PlanDocument`. The only device-local state left is the sync bookkeeping
(last-synced etag + `dirty`), which is meaningless on another device. The `{ local,
remote }` envelope split stays real, but it now divides *sync meta* from *plan*, not
*identity* from *plan*.

---

## 5. Sync triggers + conflict

**Detection: diverged = `cloud ETag ≠ lastSyncedEtag` AND local is dirty.** Other
cases are not conflicts: cloud-moved + local-clean = silent fast-forward; local-dirty
+ cloud-unchanged = normal push. Conflict only when **both** moved.

**Four trigger points:**
1. **App load (pull) — NON-BLOCKING, async fallback.** Local is synchronous → render
   the UI immediately from localStorage, fire the pull in parallel. When it lands:
   clean fast-forward → quietly adopt cloud; diverged → raise conflict resolution
   *when ready* (it appears, doesn't gate boot); slow/failed → proceed on local,
   reconcile later. At ~1 KB the pull is near-instant; "non-blocking" = no
   spinner-gate + graceful on bad network.
2. **Save/push (CAS reject).** Conditional `If-Match` PUT returns 412 → conflict
   mid-session.
3. **Manual sync button (user-initiated push / refresh).** An explicit override of
   automatic syncing — user agency to force push/pull now; same detection can surface
   a conflict.
4. **First-time auth (migration / onboarding).** First reconciliation of a
   pre-existing local plan vs a pre-existing cloud plan → if both populated,
   **immediate conflict on first link.** ∴ the dialog must exist **from v1**.

**First-sign-in / migration matrix:**
- local∅ + cloud∅ → fresh.
- local has plan + cloud∅ → push up.
- local∅ + cloud has plan → pull down.
- both populated → conflict immediately (the spiciest onboarding case).

**Resolution = pick-a-side (Steam-style)** — local vs cloud, with enough metadata to
choose. Merge stays off the table.

**DECIDED (2026-06-19) — push cadence (cloud only; local autosave stays automatic+free).**
**User-initiated** (the Sync button) is the cadence, for the $0 keystone (§10): every push
is a Worker request against the 100k/day free cap, and user-initiated gives fewer cloud
advances → fewer conflicts → clear intentional sync points. The Steam-Cloud "forgot to
sync → stale on the other device" gap is covered NOT by push-on-close but by a bounded
**push-on-OPEN**: an ordinary connected load spends exactly ONE "free credit" reconcile
(`reconcileOnLoad` → `syncNow`), so opening on a second device is reassuringly current
without lifting a finger. The cap is structural (one reconcile per load) so it never
broadens into always-push; client egress is further choked to one sync / 5s. Net: at most
one push per load + explicit Syncs, all within budget.

**DEFERRED to the weeds:** versioning / "which-is-right" logic; dialog metadata
(timestamps, device labels, value summary); exact resolution flow; sync-button
affordance shape. (High-level triggers + non-blocking load are settled.)

---

## 6. Auth

**OAuth on a static site → the Worker IS the server.** The code→token exchange can't
happen in static JS (client secret would leak); the **Worker owns the callback +
exchange**, the frontend just kicks off the redirect. Strong lean: **Cloudflare Pages
Functions / same-domain Worker** → same-origin, cookies "just work," no CORS.
**Session = httpOnly, Secure, SameSite cookie** holding a signed server session
token.

**Approach — closed at both ends.** Direct **OAuth2** to the providers + a thin
signed session.
- **OUT: managed identity platforms (Auth0 / Okta / Clerk).** Scope + cost overkill
  for "prove this is the same person across devices"; recurring bill + vendor
  dependency for a problem we don't have.
- **OUT: roll-your-own auth.** No inventing password storage, crypto, token formats.
- **IN: the boring middle.** Standard OAuth2 straight to the providers (they ARE the
  identity authority), a small well-trodden library for the redirect/exchange, a
  signed-cookie session. The Worker holding the client secret + signing sessions is
  the *entire* auth surface.

**Providers are product-fit options, not identity strategy.** The identity
architecture is fixed regardless of provider (OAuth2, `(provider, providerUserId)`,
no linking — below); *which* providers we add is a separate, audience-driven product
choice. This is *why* there's no account-linking: independent product options, keyed
independently, not one identity reconciled across many.

**Provider priority (= build order = risk order):**
1. **Google — first / WIP.** A boring, well-trodden OAuth2/OIDC path with broadest
   reach; becomes the template.
2. **Discord — second.** Many Horsetrader users already live there; essentially free
   to add once the OAuth2 path exists.
3. **Steam — deferred nice-to-have.** Mechanically awkward: **OpenID 2.0, not OAuth2**
   (a second auth flavour); returns only a SteamID (profile needs a Steam Web API
   key); + cost/account barrier (Steamworks partner = paid $100; only free path is the
   grubby demo-app-480 trick). Park until Google+Discord prove the model.
- **Out:** providers that fit neither the audience nor the use case — e.g.
  **Facebook**.

**The user contract:** cloud save is **opt-in** — log into *any one* of the offered
providers if you want it (signed-out stays local-only, unchanged). The only rule is
**be consistent**: use the *same* provider every time, because there's no linking, so
a different provider = a different account.

**No account-linking.** One provider linked at a time; identity key =
`(provider, providerUserId)`. The "Google-on-desktop / Discord-on-phone = two saves"
failure is solved **socially** — the "use the same sign-in everywhere" warning above —
not technically. No link table, no email-matching, no cross-provider merge.

### Dependency policy — the "no external deps" rule breaks here (deliberately)
Unity is the **third "first"**: first server, first secrets, **first external
dependency.** The break comes with hard strings (npm = supply-chain risk):
- **Validate every dep hard:** vet provenance + maintainer, **pin exact versions**
  (no `^`/`~`), **minimise transitive deps** (50-package tree = disqualified),
  prefer audited, vendor/review crypto-adjacent code.
- **Blast-radius shrinker — the dangerous part is native on Workers.** Session
  signing = Web Crypto `crypto.subtle` HMAC (**no dep**); OAuth2 auth-code is just
  fetch calls. So the real surface ≈ **one small vetted helper, or zero.**

**Vetting log (worked examples — bar = purpose-fit FIRST, then maturity/deps/runtime/
provenance):**
- **REJECTED `@mastercard/oauth2-client-js`** — name-trap. It's a **FAPI 2.0 / DPoP
  client for *calling* Mastercard APIs** (wrong OAuth2 use case — we need
  authorization-code social login as a relying party). Also v1.0.0/single-release,
  `axios` peerDep (Node, not edge). Provenance fine — proof that legit publisher ≠
  right tool.
- **PASS `jose`** (ID-token/JWKS verification) — v6.2.3, zero-dep, MIT, 236 versions
  since 2014, explicitly lists Cloudflare Workers, built on Web Crypto, maintainer
  `panva` (the OIDC ecosystem maintainer). Granular exports.
- **PASS `@badgateway/oauth2-client`** (RP auth-code flow) — v3.3.1, zero-dep, MIT,
  right RFCs (6749/7636/7662/8414/8707), fetch-based, maintainer `evrt`. **CONFIRM:**
  (a) clean on workerd; (b) confidential-client `client_secret` exchange (not just
  public PKCE).
- **Leaning combo:** `@badgateway/oauth2-client` + `jose`. Fallback if (b) fails:
  `panva/openid-client` (full OIDC RP, same trusted author as jose).

---

## 7. PII posture — the cloud holds plans, not people

A consistent thread, and worth stating as a principle: **Unity sheds identity from
the server rather than accumulating it.**
- **Trainer-id: deleted entirely.** It only ever existed as a feature-gating hook;
  auth identity does that now. Deleting it *dissolves* the privacy question (nothing
  to sync/mask/strip) and retires the trainer-id privacy design
  ([[project_trainer_id_privacy]]). *Downstream cleanup at integration:* remove the
  config field, its single render site, the masking plumbing.
- **Username: syncs** (reversed 2026-06-18, see §4) — a self-assigned display handle,
  not real PII, and a name crossing devices is the "sync worked" signal. This is a
  deliberate, scoped dent in the posture, not a drift.
- **No *account* PII in the cloud blob.** Real identity (email, provider id) stays
  with the OAuth provider and the signed session, never the plan. The cloud knows
  *what you're planning* and *the handle you chose*, not *who you are*.

---

## 8. Feature-gating — descoped to a future Patreon integration

Old mechanism: a hashed account-id allowlist (the `supporters.json`
`sha256(12-digit)` recipe) gating **early-access beta + dev tools**. Trainer-id is
gone → re-home the gate. But:
- **`sha256(provider:sub)` is REVERSIBLE here.** Provider = known fixed prefix; the
  sub is low-entropy/structured for the providers that matter (Steam id ~2³²
  sequential → GPU brute-force in minutes; Discord snowflake ~2²² in a knowable
  window; only Google `sub` ~2⁷⁰ resists). A plain hash does **not** hide who's on
  the allowlist.
- **The impossibility:** you can't have both a client-distributable allowlist AND
  non-reversible members, given low-entropy ids + a fast public hash. Non-reversible
  needs an HMAC with a server-held secret → which forces **server-side enforcement**
  anyway.
- **∴ gating is DESCOPED from Unity.** Future home = a **Patreon integration**
  (separate project): Patreon's OAuth + webhooks make "paying member at tier X" a
  server-side, authoritatively-verified check (Patreon = source of truth, no
  allowlist). Patreon does **double duty** — entitlement gating *and* cost-funding
  ([[feedback_zero_cost_principle]]), both gated on the same "if it gets big"
  condition. **For Unity: no feature-gating in scope.**
- (Aside: the old supporters hash had the same weakness but harmlessly — supporter
  trainer-ids are public via uma.moe; beta/dev membership is more sensitive.
  [[project_supporters_feature]])

---

## 9. Beta page — staging ground (general-use)

A button next to Tazuna (→ right surface group, `view.right`) opens a **"beta page"**
surface. Three jobs at once ([[project_beta_page]]):
1. **General WIP incubator** — home for grab-bag/half-proven features (needed anyway,
   not Unity-specific).
2. **Unity's in-app isolation chamber** — login/sync lives *here* behind the beta
   button, NOT threaded into the main persistence coordinator until proven.
   **Graduation = moving out** into the main app. Keeps unproven server/auth code off
   the main path.
3. **The future Patreon early-access area** — the "early-access beta" gating was for
   IS this page; Patreon (§8) eventually gates it. For now (proving out) it's open /
   dev-accessible.

→ The membrane between proven and unproven; "Patreon early-access" = letting
supporters into the incubator early. (UI detail — surface vs shield, button styling —
is weeds.)

---

## 10. Cost — the $0 keystone

**$0/month is the existing architecture keystone, not a Unity preference.**
[architecture.md](../docs/frontend/architecture.md): *"…push all runtime compute onto
the client. The player pays their own compute; the dev never gets a server/compute
bill."* Two clauses: (1) "no backend/server/API — and no plans for one"; (2) "the dev
never gets a bill."

**Unity RELAXES clause 1** (adds the Worker — first server) **but is absolutely BOUND
by clause 2.** $0 is the **price of admission for adding a server at all** —
non-negotiable. (*Doc-update owed at integration:* clause 1's "no plans for one" is
now false.)

**What's protected = the dev's wallet, not revenue-purity** ([[feedback_zero_cost_principle]]).
Hobby project, dev unemployed → no *unfunded* out-of-pocket bill (concrete fear ~$800/yr).
Self-correcting: cost and Patreon funding both scale with users, so the only world
where it costs real money is the world where Patreon can fund it; the danger is
"unfunded at any scale," never "too popular."

**∴ design must live in the free tiers at realistic scale**; "just casually pay $5/mo
Workers Paid" is OFF the table. Binding free limits = the real spec:
- **Workers: 100k requests / DAY** (tightest — every sync op = 1 request).
- **R2: 1M Class A/mo (pushes), 10M Class B/mo (pulls); 10 GB storage.**

Frugality is first-class → minimise Worker requests + R2 ops → *why* push leans
user-initiated/push-on-close (§5). Full cost model + sizing: [appendix.md](appendix.md).

---

## Loose ends (not yet placed)
- **Offline edit queue** → flush on reconnect (a push with the stored ETag; may
  conflict → dialog).
- **Multi-tab same device** — BroadcastChannel / storage events so tabs don't fight.
- **Account deletion / data export** — GDPR-ish hygiene now we hold user data.
- **Sign-out** = stop syncing, keep the local copy (Steam: log out ≠ wipe local).
- **Mid-session pull trigger** — focus/open only, or poll? Steam syncs on open/close;
  probably enough. Avoid realtime.
- **Session/token specifics** — cookie attrs, refresh, sign-out flow (the §2 security
  surface).

---

## Appendices — moved

Research findings (the **pricing model** and **user-base sizing** that proved the
$0 and TAM assumptions) live in [appendix.md](appendix.md). They're reference now —
not re-read on every pass. §10 cites them.
