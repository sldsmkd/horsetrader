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

### L1 · Core entity API ✓ done 2026-06-08 (#35 closed)

Resolved as a right-sized **query seam**, not the entity-model framework the
original scope sketched — the graph was explicitly considered and rejected (no
consumer traverses entity links; favouriting a card is a flat
`contents.includes` filter; a runtime graph fights bake-the-heavy-lifting and
house style). `search/index.ts` and `oshi/index.ts` now sit behind `ui/query/`
over a shared `match.ts` (`normalize` + `rankPrefixMatch`), behaviour-preserving.
Documented in `docs/frontend/catalog.md` (the entity query broker). Lives at
`ui/query`, not `core/`, because the `Bundle` loader it wraps is in `ui/bundle`
and `core` must not import `ui`. Deferred until a consumer needs it:
`eventsFeaturing(key)` (favouriting) and standalone `label`/`image`.

---

## Deferred / no action yet

- `rate_overrides` and `rushable` fields are in the schema but have no frontend
  consumer. Leave them alone until the gacha-rate surface is scoped.
- `strings.ts` `FALLBACK_STRINGS` duplicates `strings.json` — accepted trade-off
  for fetch-fail resilience; no action needed.
- `docs/ideas/menu.md` (513 lines) is exploration notes, not a spec. Review when
  the menubar epic (**#22**) surfaces that need to match it.
