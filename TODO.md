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

### S2 · State machine as a general-purpose primitive ✓ done 2026-06-08

`ui/state/machine.ts` — `createMachine<S, E>(reducer, initial)` → `{ get, send }`.
Identity machine wired as first consumer; extra `savedPlayStyle` arg bound via closure
at construction. `toggleOverlay` reset replaced with `send({ type: "close-all" })`.

---

## M — each needs a branch

### M1 · Widget library: toggle buttons and reward strip home ✓ done 2026-06-08

Two recurring patterns need a canonical home:

**Toggle/selected buttons** — `aria-pressed` select-one-from-N appears
independently in `oshiSelector.ts`, `playStylePreset.ts` (3-state: saved /
previewing / locked), and `menubar.ts`. Extract a `toggleButton()` or
`selectedGrid()` primitive to `ui/widgets/`.

**Reward strip** — `rewardStrip.ts` just landed. When the banner card surface
arrives it will need the same footer. Confirm `rewardStrip` is the canonical
widget (no duplicate); establish `ui/widgets/` as the home for shared view
primitives so future surfaces reach for it rather than rolling their own.

### M2 · Separate controller data from overlay DOM construction ✓ done 2026-06-08

Controller stripped to data accessors only (`trainerName`, `currentOshi`,
`oshiSearch`, `setTrainerName`, `setOshiId`); `strings` dep removed from
constructor. New `ui/views/identityOverlay.ts` owns all overlay wrapping and DOM
construction (`buildTrainerCard`, `buildOshiSelectorOverlay`,
`buildPlayStyleOverlay`).

### M3 · Flatten `renderOverlay` closure depth in `app.ts` ✓ done 2026-06-08

`trainerCard()` and `playStyleBook()` inner closures replaced by direct calls to
the standalone builders from M2. `renderOverlay` is now a flat switch over
`AppOverlay` states. Pre-existing `createMachine` type-inference bug fixed
alongside (`<PlayStyleMachineState, PlayStyleMachineEvent>` explicit params).

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
