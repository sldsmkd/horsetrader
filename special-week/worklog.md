# Special Week — worklog

> Skunkworks. Codename **Special Week**. Thesis: **the first day** — Tazuna walks a
> brand-new visitor through the chrome once, then is gone forever. See [spec.md](./spec.md).

## Log

### 2026-06-24 — kickoff + design lock

- Established thesis ("the first day" = a one-shot first-run tour, not a permanent
  help affordance — Kris's narrowing of the docs' dual-role Tazuna).
- Surveyed the ground: Tazuna the guide-NPC is **designed but never wired**
  ([menu.md](../docs/frontend/menu.md), [first-run feedback](../docs/frontend/feedback/2026-06-04-first-run.md));
  old face-avatar retired ([TODO.md:205](../TODO.md)). Two unrelated Tazunas — the
  guide NPC (this) and the `@tazuna` ETL grab-bag decorator (not this).
- A fresh visitor loads `emptyDocument() = { version }` — no `config`/`identity`/oshi
  ([document.ts:132](../horsetrader.site/js/src/core/persistence/document.ts)). Clean
  first-run signal already exists.
- Assets on hand: `tazuna-hayakawa_portrait.webp` (standing) + `_icon.webp`.

**Decisions locked (Kris):**
1. First-run onboarding ONLY — no permanent help icon (reshapes docs' dual role).
2. Tazuna pops as **her own surface** (portrait + blurb) that **spotlights the live
   chrome** she's describing (coachmark), with an optional screenshot fragment.
3. **Static** portrait + speech. No dash skit. (Dash = why she fits, not a feature.)
4. Gacha-pull guardian cameo OUT of scope (maybe future).
5. Progress is a synced **`firstrun: int` watermark**: unset→0; show stages with
   index > firstrun; persist firstrun = highest shown. Append-only registry so a
   later stage N+1 reaches existing users without replaying old tours.

Spec written: [spec.md](./spec.md). Build not started — next is the surface home
decision (top-level overlay vs surface-group member) and the stage registry/copy.

### 2026-06-24 — scope tightened to three nudges (Kris)

Onboarding is NOT a product manual — it resolves exactly the three failure modes
first-run users hit, on the journey **record what you have → describe how you play
→ choose what you want**. Stage list fixed:

1. **Welcome** card (no spotlight) + "Start setup" CTA → "Horsetrader helps you plan
   future banners by projecting the resources you'll earn and whether you can afford
   your targets."
2. **Resources first** (concrete prerequisite) — spotlight `menubar__balance` →
   "Start here: record what you have today…"
3. **Trainer second** (play style shapes the forecast) — spotlight `menubar__identity`
   → "Choose a play style… Click the Trainer card to set your name, oshi and detailed
   assumptions."
Outro: "You're ready — click any banner number to start planning."

Excluded by design: banner explainer (conspicuous number + commit shield self-teach),
card details, minimap, search = normal discovery. Targets are existing menubar
buttons, so no new spotlight anchors needed.

### 2026-06-24 — reorder: Trainer before Resources (Kris)

Flipped the spotlight order. Trainer/identity FIRST, Resources second. Three reasons,
all pointing the same way: (1) **emotional context** — picking your oshi/name is the
"this is mine" hook; earn engagement before the carat-entry chore; (2) **spatial scan**
— identity is top-left, carats top-right, so left→right matches natural reading;
(3) the forecast tolerates zero carats for one extra step, so the prerequisite logic
that justified carats-first is the weaker pull. Journey spine now **make it yours →
record what you have → choose what you want**. Resources copy "Start here" → "Now record
what you have today…".

### 2026-06-24 — BUILT v1 (branch `special-week-onboarding`)

End-to-end on the branch; tsc clean, 271 tests pass (added a firstrun round-trip test).

- **Watermark plumbing** — `coordinator.firstrun()` (absent⇒0) + `setFirstrun(stage)`,
  a *silent* persist (no notify/re-derive, like `persistNote`): the mark is synced plan
  state but economically inert, so a full timeline rebuild per bump would be wasted.
  Lives in the loose `config` bag, so no validate change needed.
- **Overlay** — `ui/views/onboarding/onboarding.ts` + `.css`. Modal coachmark: the
  spotlight element's huge `box-shadow` IS the scrim (bright cutout over the live menubar
  button), Tazuna portrait + one-line blurb beside it, Next/Skip, Esc=skip, reflows on
  resize. Centred (flat-scrim) layout for the targetless welcome + outro. Registry is
  APPEND-ONLY (1 welcome, 2 `.menubar__identity`, 3 `.menubar__balance`), outro un-gated.
  Fail-soft: a missing target degrades to centred, never blocks.
- **Mount wiring** — `startOnboarding()` in app.ts. Persists per-stage (resume on reload);
  skip/finish jumps the mark to N.
- **OPT-IN ONLY (Kris) — no auto-run on mount.** The first-mount trigger is deliberately
  NOT wired: the *only* way to launch the tour is the beta-chamber dev knob (supporter-
  gated), so we dogfood it before it greets real first-run visitors. Going live = defer a
  `startOnboarding()` a frame after `refresh()` (a one-line flip, noted in the app.ts comment).
- **Beta-chamber dev knob** — `betaSurface` gained "Replay all" (firstrun=0) + per-stage
  chips (set N-1); the app re-arms the tour inline over the open chamber. Behind the
  supporter gate, never a real-user surface. This is the sole entry point for now.

Not committed; not deployed.

### Open / possible follow-ups
- Eyeball the live spotlight placement + portrait crop on :3000 (esbuild watch picks it up).
- Bake screenshot fragments (`shot?`) if a live spotlight ever reads ambiguously — unused in v1.
- The `@tazuna` ETL grab-bag unbundling remains a separate, untouched cleanup.
