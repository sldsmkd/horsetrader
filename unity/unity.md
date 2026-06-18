# Unity — cloud save/load (skunkworks)

> Codename **Unity**, ex the in-game *Aoharu Hai — Unity Cup: Shine on Team
> Spirit!*. Thesis: **working together / unification** — one account, one save,
> coherent across devices. Read the name as the design: local and cloud *working
> together*, not cloud replacing local.

This is the **framing / overview**. The detailed design lives in
[design.md](design.md) (with cost + sizing appendices). Status: **kickoff design
done 2026-06-18** — designed at altitude end-to-end; prototyping next.

The first skunkworks that **adds a capability** rather than re-architecting an
existing subsystem (cf. Eclipse = economy engine, Trackblazer = renderer). It spans
**both** halves of the monorepo and stands up the project's **first server**.

## The goal

A player using the planner on their phone and their desktop should see **one save**.
Sign in once per device; thereafter the plan they build anywhere shows up everywhere,
without manual export/import. The whole of it: **authenticate, then unify the save
across devices.**

## Overview — three ideas hold the design together

1. **Steam Cloud, local-first.** Local localStorage stays the synchronous working
   copy (offline + signed-out unchanged); the cloud is a synced mirror beside it,
   reconciling at session boundaries. Conflict is a first-class, rare event resolved
   by **pick-a-side**, never a silent overwrite.
2. **The trust-model flip.** Unity is the moment the app gains a server, external
   comms, other users' data, and secrets — so it carries a real **security
   obligation** the rest of the (local-only) app was exempt from. This is the one
   place threat-modelling is warranted.
3. **$0 is the keystone.** The architecture's founding rule is "the dev never gets a
   server/compute bill." Unity is *allowed* to add a server **only because** it
   commits to staying inside the free tiers. $0 is the price of admission, and it
   makes **frugality a first-class design driver** (it shapes the sync cadence).

Two postures fall out and recur throughout: **the cloud holds plans, not people**
(PII is shed, not accumulated), and **spend the complexity/dependency budget
precisely** (tiny saves collapse most hard problems; one or two vetted deps, native
crypto otherwise).

## Decisions at a glance

| Area | Decision |
| --- | --- |
| **Spine** | Local-first, Steam-Cloud sync on top; the synchronous `KeyValueStore` stays synchronous (cloud layer is async beside it). |
| **Platform** | Cloudflare. The server is a **Worker** (the project's first). |
| **Storage** | **R2**, one object per account; the **object ETag IS the sync rev** (CAS via conditional `If-Match` writes — no hand-rolled counter). |
| **Data plane** | The Worker mediates **both** directions; R2 is a private binding, never browser-facing. Push the **whole ~1 KB blob**, no delta/merge. |
| **Auth** | Direct **OAuth2** to the providers + a thin signed-cookie session. **Providers are product-fit options, not identity strategy** — order **Google → Discord → Steam(deferred)**, chosen by audience fit. No account-linking (warn instead). |
| **Conflict** | Detect via ETag divergence + local-dirty; 4 triggers (load / push-reject / sync-button / first-auth); **pick-a-side**. High-level done; versioning weeds deferred. |
| **PII** | Trainer-id **deleted**; username **local-only**; the cloud blob is identity-anonymous. |
| **Cost** | **$0**, inside the free tiers. Binding limit = Workers 100k req/**day**. Frugal push cadence (lean user-initiated / push-on-close). |
| **Deps** | The "no external deps" rule breaks **once, under audit**; leaning `@badgateway/oauth2-client` + `jose`. Security scanning enters the pipeline (JS/Worker surface only). |

## Scope

**IN:** cross-device save sync; Google then Discord OAuth; the Worker + R2 data
plane; conflict resolution (pick-a-side); the beta page as Unity's in-app staging
ground.

**DEFERRED (own scope, later):** Steam auth (OpenID-2.0 + paid-account friction);
feature-gating → a **Patreon integration** (which also funds any real scale-cost);
the conflict-versioning weeds; session/token mechanics detail.

**OUT (won't do):** account-linking; off-audience providers (e.g. Facebook);
managed identity platforms (Auth0/Okta); roll-your-own auth; Python-ETL security
hardening (no external audience); any recurring out-of-pocket bill.

## What is explicitly NOT changing

- The local, signed-out experience — identical to today.
- The four input sections, the migration ladder, the fail-soft load pipeline.
- The projection engine and all of `core/` downstream of persistence.
- The synchronous `KeyValueStore` interface.

## Status & next steps

Designed end-to-end at altitude (2026-06-18). Per the skunkworks method, next is
**de-risking in this folder**:

1. Thin Worker prototype: prove the **R2 ETag CAS** (pull → conditional push →
   412-on-conflict) and confirm the `onlyIf` shape + free-tier limits.
2. Prototype the **Google OAuth round-trip** end-to-end (redirect → callback →
   identity → signed-cookie session); confirm `@badgateway/oauth2-client` runs on
   workerd + does the confidential-client exchange.
3. Nail the **conflict-detection + resolution** mechanism against the prototype (the
   deferred versioning weeds).
4. Spec, then integrate — staging behind the **beta page** first, graduating into the
   main app once proven.
