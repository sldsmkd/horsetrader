---
name: project_ui_design_doc
description: Frontend view layer is being captured intent-first across sessions into docs/frontend/ui.md
metadata: 
  node_type: memory
  type: project
  originSessionId: 3a7a37fd-8dd3-44f7-bbb5-523a214ef62e
---

The `ui/` view layer (deliberately deferred per [[project_projection_engine]]) is
being designed **intent-first, surface by surface**, before any code. Capture
lands in `docs/frontend/ui.md`. Method: user screenshots a prototype surface
(`_horsetrader.old/site.old/`), narrates intent/mistakes/feedback; I distil into
ui.md. **Intent over appearance** — not "widgets are navy", but why a surface
exists and what it makes legible.

As of 2026-06-02 the foundation is laid: a **10-principle spine** (timeline =
persistent substrate; true-to-date axis; above/below = P&L sink/source axis;
anchor-sacred-body-negotiable; colour/grey = meaning; informs-never-enforces;
one-way state no DOM-as-truth; contained pure-geometry layout; target 1080p/tablet;
**#10 the unit of spend is pity not pulls** — commit in pities, derive carats; "a
30-pull is not a plan, it's a lottery ticket"). Captured surfaces: timeline detail
+ **transaction timing** (last-day posting → intended dot/line *lag*, accepted as-is;
**rushable events** = opt-in start-post at an efficiency cost, makes the planner a
what-if explorer; needs ETL/core upstream work); the **banner card** (pills =
favouritable atoms, borrowed game rarity grammar gem/gold [R culled], the
**resource readout** = balanceAt folded from four streams gift/carat/daily/ticket
with density-but-not-chaff rule, the **value highlight** glow = intrinsic "good
place to pull" driven by free-pull count, researched in ../domain.md); **bookmarks**
(favourites→nav + scarcity "do I only have one shot"); the **minimap** (carat
balance line — NOT pities, frets=30k=1pity, green/blue favourited-appearance dots
mirror bookmarks, blue→red danger); three layout edge cases.

**As of 2026-06-02 ALL surfaces are captured** — the doc is feature-complete; next
step is `ui/` code. Surfaces added that session: the **menubar** (persistent chrome;
**one warp primitive** — Home/bookmarks/search all = accelerated inertial scroll to
a target x; carat readout = balanceAt(viewDate) in carats, bidirectional grey-trust,
**clicking it opens account**, empty state = bootstrap CTA); **search** (thin
find+warp lens, results stay on the live axis, game-grammar typeahead, reruns
delegated to the star); the **account overlay** (snapshot/re-anchor decomposed into
real resource pools + income config; **mirrors the Henry Handsome Carat Calculator**
so concepts are pre-taught, see [[project_henry_handsome_prior_art]]; resolves
principle-3 — income is global/parametric, below-lane stays passive); the
**dev/debug panel** (grab-bag; load-bearing rule = force-date↔saving interlock;
export = support+backup affordance; native `alert()` = intentional dev-only breach
of the no-modal rule); the **what's-new overlay** (minimal/deferred, non-blocking);
the **planner** (NOT a planner — it's the **read-only materialised plan**;
commitment-scoped, shows per-row four-stream source breakdown + expected-copies
None/0LB..MLB stats; edit at-source on the banner, plan only confirms + jumps;
**favourites = who/what, plan = when/how**; plan vs bookmark-drawer = two distinct
siblings; **screenshot-first** shareable artifact / link = growth loop; rows warp
the *background* timeline → concrete origin of principle 1's **absolute scroll
invariant**: nothing ever captures timeline scroll, overlays float-until-dismissed).
Principle 1's focus-taking exception was **retired** (no-modal rule now absolute).
Cross-side ETL deps were **pulled out of ui.md into the root `TODO.md`** (the user
will run an ETL session against it): **(1) search** (atom catalogue + aliases —
`docs/references/import/search_aliases.yaml`), **(2) free pulls** (per-banner gift
count — `docs/references/import/free_pulls.yaml`), **(3) rushable** (per-event flag +
rushed semantics in core — the one real modelling lift). Both yaml files are **old
prototype data, not yet reintegrated**. League of Heroes is NOT a dep (fits the
existing event shape — just data density). Open *threads* (not surfaces) remain
inline in ui.md. Frontend-side concern — don't cross into ETL (see
[[project_workspace_split]]).
