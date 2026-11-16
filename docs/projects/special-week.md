# Special Week — the first day

Status: **shipped and live (2026-06-24).**

> Codename **Special Week** — the country-girl newcomer shown the ropes by Tazuna on
> her first day at Tracen. Thesis: **the first day** — a brand-new visitor lands on a
> live, unfamiliar planner, and Tazuna walks them through the chrome once, then gets
> out of the way forever.

The durable design — the `firstrun` watermark, the stage registry, the coachmark —
is documented in [frontend/menu.md § First run](../frontend/menu.md#first-run-tazunas-tour).
This page is the project record.

## Why

First-run testing ([feedback/2026-06-04-first-run.md](../frontend/feedback/2026-06-04-first-run.md))
found nearly every friction point was the user **inferring** rather than being
**told**. The menu design had prescribed Tazuna as a *dual-role* guide (permanent
help icon **and** onboarding). Kris narrowed it: **first-run onboarding only, no
permanent help icon.** The old menubar avatar had already been retired in Debut.

Tazuna fits because players already associate her with tutorials and the
trainee-gacha guardian skit — the engagement is pre-taught.

## Decisions

1. First-run onboarding **only** — no persistent help affordance.
2. Tazuna is her own surface (portrait + one-line blurb) that points at the live
   chrome. No bespoke input wizard: she points at the real buttons.
3. **Static** portrait. The dash-to-the-doors skit is *why* she fits, not a feature.
   The gacha-pull guardian cameo is out of scope.
4. Progress is a synced **`firstrun` high-water mark** with an append-only stage
   registry, so a later stage reaches existing users without replaying old ones.
5. **Three nudges, not a manual.** The journey is *make it yours → record what you
   have → choose what you want*: Welcome → Trainer → Resources → outro ("click any
   banner number to start planning"). Banner mechanics, card detail, minimap and
   search are left to normal discovery — the commit dossier explains itself.
6. **Trainer before Resources** (reversed from the first draft): picking your oshi
   is the "this is mine" hook; identity is top-left and carats top-right, so the
   ring sweeps in reading order; the forecast tolerates zero carats for one step.

## How the build evolved

- **v1** — modal coachmark: a dimming box-shadow scrim with a cutout over the
  target, Tazuna placed beside it, MutationObservers to relax/hide the dim when
  menu surfaces opened.
- **"I can't choose my trainer card"** — the hard modal blocked the very control it
  pointed at. Made it click-through: clicking the ringed target opens the real
  surface *and* advances the tour.
- **Simplified** (Kris: "keep her centred and use the green highlighting") — no dim,
  a fixed centred panel anchored low, and a green interactive-colour ring that
  glides between targets. The observers, relax/hide classes and positioning math
  were deleted; nothing obscures anything, so nothing has to step aside.
- **Opt-in first, then live.** It initially ran only from the beta chamber's dev
  knob for dogfooding; it now auto-runs a frame after the first `refresh()`. Every
  existing user started at `firstrun = 0`, so each saw the tour once.

The beta-chamber knob (Replay all + per-stage chips, supporter-gated) is kept as a
repro seam.

## Open follow-ups

- Screenshot fragments per stage (`shot?`) — unused; add only if a live ring reads
  ambiguously.
- `@tazuna` the ETL decorator is an unrelated grab-bag of cross-cutting utilities
  ([`horsetrader/semantics/tazuna.py`](../../horsetrader/semantics/tazuna.py)) that
  should eventually be unbundled. Not this project — noted so the two Tazunas
  don't get conflated.
