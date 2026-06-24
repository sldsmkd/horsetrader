# Special Week — spec

> Skunkworks. Codename **Special Week** — the country-girl newcomer who arrives at
> Tracen for her first day and is shown the ropes by Tazuna. Thesis: **the first
> day** — a brand-new visitor lands on a live, unfamiliar planner and Tazuna walks
> them through the chrome once, then gets out of the way forever.

## Why now

First-run testing ([feedback/2026-06-04-first-run.md](../docs/frontend/feedback/2026-06-04-first-run.md))
found nearly every friction point was the user **inferring** rather than being
**told** — what the site is, what a glyph means, what a config knob does. The docs
([menu.md](../docs/frontend/menu.md)) prescribed a "Tazuna" guide NPC with a *dual*
role (on-demand help **and** onboarding). Kris's call narrows it: **first-run
onboarding only, no permanent help icon.** The old face-avatar was already retired
([TODO.md:205](../TODO.md)); we build the onboarding half from a clean slate.

Tazuna is the right face because players already associate her with tutorials and
with the trainee-gacha guardian skit — the engagement is pre-taught (same logic as
the Henry-Handsome calculator mirroring: borrow a concept the audience already holds).

## Non-goals

- No persistent help affordance / info-circle-everywhere (Kris: first-run only).
- No animated dash-to-the-doors skit (static portrait + speech). The dash is *why*
  Tazuna fits, not a deliverable.
- No gacha-pull guardian cameo. Out of scope; maybe a future project once first-run
  lands.
- No bespoke input wizard. We do **not** duplicate the oshi/resources/playstyle
  inputs — Tazuna *points at* the real chrome; the player opens the real surfaces.

## Mechanism

### The `firstrun` watermark (Kris's design)

A single synced integer: `remote.config.firstrun`.

- Unset / absent → treat as `0` (brand-new visitor).
- On mount, show every stage whose index `> firstrun`, in ascending order.
- After a stage is shown+dismissed, persist `firstrun = max(firstrun, stage.index)`.

It is a **high-water mark of tours seen**, not a boolean. Consequences:

- A brand-new user runs 1 → N.
- A later-added stage `N+1` fires for *everyone* whose `firstrun < N+1` — existing
  users get only the new tour, never a replay of the old ones.
- It syncs (lives in `remote.config`), so a returning user on a second device
  doesn't re-onboard. (Acceptable corollary: a *new* device for an existing user
  also skips — the watermark travels with the plan. Correct: onboarding is about
  the person, not the device.)

Decision: stage indices are a contiguous `1..N` registry order, NOT semantic IDs.
Reordering tours is a breaking change to the watermark — so **append, never
insert**. A comment on the registry will say so.

### The coachmark surface

Tazuna pops as her **own surface** (her portrait + a blurb), and **spotlights the
live chrome** the blurb is about:

- A full-viewport scrim with a *cutout* over the target element's bounding box
  (box-shadow spotlight or SVG mask), so the real button/area stays visible and
  lit while everything else dims.
- Tazuna portrait (`tazuna-hayakawa_portrait.webp`) + speech panel positioned near
  the target (flip side to avoid covering it).
- Optional **screenshot fragment** per stage (a small baked image of the thing, for
  when the live target is awkward to point at — e.g. a hover-only affordance).
- Controls: `Next` (advance), `Skip` (dismiss the whole run, watermark jumps to N).
- Each stage targets a CSS selector resolved at show-time; a missing target is
  fail-soft (skip that stage, still advance the watermark) so chrome changes never
  brick the boot.

This is a new surface but a *thin* one — it renders over the mounted app, reading
real element rects. It is modal against the menu surfaces (reuse the lock pattern)
but must not block the timeline/minimap underneath from being seen (it's a teaching
overlay, not a blocker).

### Scope — three nudges, not a manual

This is NOT a splash of product documentation. It resolves the **three failure
modes** real first-run users hit, and nothing else. The core journey:

> **Make it yours → record what you have → choose what you want.**

(Describe how you play → record what you have → choose what you want — leading with
identity for emotional context.) That is Horsetrader in one line, and it maps
directly onto the three things users actually miss. Everything else (banner mechanics, card details, the minimap) is
*normal discovery*, deliberately left out — once a user clicks the very conspicuous
banner number, the commitment shield already explains itself
([[project_commit_shield_built]]).

### Stage registry (v1 — fixed)

Ordered list; each entry = `{ index, target, blurb, shot? }`. The "you're ready"
outro is the tail of the run, not its own gated stage.

1. **Welcome** — a compact centred card, no spotlight, with a **Start setup** CTA
   that dismisses the card and begins the spotlight run over the live UI.
   *"Horsetrader helps you plan future banners by projecting the resources you'll
   earn and showing whether you can afford your targets."*
2. **Trainer first** (emotional context — "this is mine") — spotlight the Trainer /
   identity button (`menubar__identity` → `onIdentity`).
   *"Choose a play style to tell Horsetrader how actively you play. Click the Trainer
   card to set your name, oshi and detailed assumptions."*
3. **Resources second** (now the concrete carat snapshot) — spotlight the menubar
   balance / resource panel (`menubar__balance` → `onResources`).
   *"Now record what you have today so Horsetrader can project your future balance."*

**Outro** (closing beat after stage 3, not separately gated): *"You're ready — click
any banner number to start planning."*

Targets are existing menubar buttons, so the spotlights need no new anchors. Order
is load-bearing: **Trainer before Resources** — picking your oshi/name is the "this
is mine" engagement hook, and earning that emotional context first makes the carat
snapshot feel like *your* setup rather than a cold data-entry chore. It also matches
the **spatial scan**: identity is top-left, the carat numbers are top-right
([menubar.ts](../horsetrader.site/js/src/ui/views/menubar.ts) — `identity` in the left
cluster, `balance` in the right), so Trainer→Resources sweeps the spotlight in
natural left-to-right reading order. (Earlier draft led with Resources on prerequisite
logic — the forecast computes from carats — but it can sit at zero for one extra step;
engagement-and-scan-order win.) Future tours append at index 4+.

Deliberately **excluded**: a banner-planning explainer (the conspicuous number +
commit shield self-teach), card details, minimap, search — all normal discovery.

### The handoff is the finish line

After the outro the tour **dismisses for good** (watermark = N) and the player is
loose in the live UI. The three nudges have done the engagement job — pointed them
at the two inputs that make the forecast theirs and named the payoff (banner
numbers). From here it's free exploration; the onboarding does not shepherd further,
re-appear, or track completion of the setup it suggested. Click-around *is* the
success state.

## Dev affordance — firstrun setter in the beta chamber

The watermark is sticky-by-design (you see each tour once, ever), which makes it
painful to iterate on. So the **beta chamber** ([betaSurface.ts](../horsetrader.site/js/src/ui/views/surfaces/betaSurface.ts))
— now gated on the **supporter entitlement tied to cloud identity** (`setBetaAvailable`,
watched off every cloud pull; not the old `?umamark` flag — that docstring is stale)
— gets a small `firstrun` control beside "Run UmaMark". The beta cohort (Kris + exz)
is exactly who should be iterating the tour, so this home doubles as both dev knob
and beta dogfooding; it never appears for a non-supporter visitor:

- **Reset** (`firstrun = 0`) — replay the whole tour from the next mount.
- **Jump to stage N** — set the watermark to `N-1` so stage N shows next, for
  testing a single tour's copy/spotlight in isolation.

It writes the same synced config field the real flow reads, then the tour re-arms
on the next refresh (or we re-run it inline). Gated by the chamber, so it ships
with the feature without a separate flag. Not a real-user surface.

## Open questions for build

- Surface home: new `ui/views/surfaces/onboarding.ts` vs a top-level overlay
  outside the surface group? (It points at the menu, so it can't be *inside* a menu
  surface.) Lean: top-level overlay mounted by the app shell, driven off `firstrun`.
- Screenshot fragments: bake them, or skip for v1 and rely on live spotlights only?
- Persistence cadence: write the watermark per-stage (survives a mid-tour reload) vs
  once at the end. Lean: per-stage.

## The ETL grab-bag aside (NOT this project)

`@tazuna` the decorator is an unrelated junk-drawer of cross-cutting ETL utilities
([semantics/tazuna.py](../horsetrader/semantics/tazuna.py)) — its own docstring warns
against it. Kris flagged it should be unbundled eventually. Tracked here only so the
two Tazunas don't get conflated; it is not in scope.
