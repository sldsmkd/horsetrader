# Technical debt — post-weekend cleanup pass

Captured after the June 5–8 Codex session. Items are grouped by effort, smallest
first. XS items are cheap enough to bundle in one context window; larger items
each want a focused branch.

---

## Close / already done

- **#41 reward chin** — `rewardStrip.ts` landed in the `rewards` branch and is
  wired into `belowCard`. Close this issue.

---

## XS — bundle in one pass ✓ done 2026-06-08

- **X1** · `suspendOverlay` extracted to `views/overlay.ts`; inline removed from `controller.ts`.
- **X2** · Machine state renamed `"trainer"` → `"identity"`; bridge reduced to one-liner.
- **X3** · Icon intrinsic dimensions corrected to `16×16` (matches 1rem CSS render size).
- **X4** · `visible !== false` guard added in `createBundle`; closes frontend side of **#21**.

---

## S — one focused session each

### S1 · Unify staged play-style state ✓ done 2026-06-08

`stagedPlayStyleSettings` moved into `PlayStyleMachineState`; machine handles all
clearing internally. `sendIdentityEvent` collapsed to 2 lines; `toggleOverlay` loses
its manual clear; `onSettingsChange` fires `stage-settings` instead of direct assignment.
`preview-playstyle` resets settings to null (renderOverlay's fallback covers preset defaults).

### S2 · State machine as a general-purpose primitive

`identity/playStyleMachine.ts` is already a clean pure reducer. As more overlay
surfaces arrive (Plan, Tazuna, Resources) the same reducer shape will appear again.

Extract a generic `createMachine<S, E>(reducer, initial)` wrapper — thin, no
new behaviour — and move it somewhere in `core/` or a new `ui/state/machine.ts`.
The identity overlay machine becomes the first consumer; future surface machines
follow the same pattern. Related to **#39**.

---

## M — each needs a branch

### M1 · Widget library: toggle buttons and reward strip home

Two recurring patterns need a canonical home:

**Toggle/selected buttons** — `aria-pressed` select-one-from-N appears
independently in `oshiSelector.ts`, `playStylePreset.ts` (3-state: saved /
previewing / locked), and `menubar.ts`. Extract a `toggleButton()` or
`selectedGrid()` primitive to `ui/widgets/`.

**Reward strip** — `rewardStrip.ts` just landed. When the banner card surface
arrives it will need the same footer. Confirm `rewardStrip` is the canonical
widget (no duplicate); establish `ui/widgets/` as the home for shared view
primitives so future surfaces reach for it rather than rolling their own.

### M2 · Separate controller data from overlay DOM construction

`IdentityController.trainerCardOverlay()` and `oshiSelectorOverlay()` build
`<div class="overlay">` elements, including title bars and close buttons. The
controller is crossing into the views layer.

Refactor: the controller exposes data accessors only (`trainerName()`,
`currentOshi()`, `savedPlayStyleKey()`, etc.). `app.ts` (or a dedicated surface
module) owns all overlay wrapping and DOM construction. This also removes the
duplicated suspend logic (X1 is a prerequisite).

### M3 · Flatten `renderOverlay` closure depth in `app.ts`

`trainerCard()` and `playStyleBook()` are inner closures inside `renderOverlay()`
inside `mountApp()`. `playStyleBook()` contains a `requestAnimationFrame` for
height-sync. Three levels of closure capture different state and make the logic
hard to trace.

Replace with standalone `buildIdentityOverlay(state, deps)`,
`buildPlayStyleOverlay(state, deps)` etc. — top-level functions that take their
dependencies explicitly. Natural to tackle alongside M2 since both touch the same
overlay rendering path. Related to **#39**.

---

## L — design first, implement when the second consumer arrives

### L1 · Core entity API

**#35** — the biggest item; don't implement speculatively.

The tell: `search/index.ts` and `oshi/index.ts` each reach directly into `Bundle`,
independently joining `bundle.support()` + `bundle.character()`, building display
labels and appearance maps. They are both re-deriving "a support card entity is a
support record joined with its character". A future banner card surface and any
account config surface will face the same join.

Direction: a `core/catalog` (or `core/entities`) layer that owns the
character+trainee+support joins, canonical labels, identity terms, and portrait
resolution. Search and oshi selection become queries against the catalog rather
than ad-hoc bundle iterations. `visible` filtering also belongs here once X4 is
in.

Defer until search or a second entity consumer makes the duplication concrete
enough to see the right shape. Document the gap in **#35** when that moment
arrives.

---

## Deferred / no action yet

- `rate_overrides` and `rushable` fields are in the schema but have no frontend
  consumer. Leave them alone until the gacha-rate surface is scoped.
- `strings.ts` `FALLBACK_STRINGS` duplicates `strings.json` — accepted trade-off
  for fetch-fail resilience; no action needed.
- `docs/ideas/menu.md` (513 lines) is exploration notes, not a spec. Review when
  the menubar epic (**#22**) surfaces that need to match it.
