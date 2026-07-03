# Glass interaction targets — proposed contract and migration register

> **SUPERSEDED 2026-07-03** — historical design/worklog record from the Grand Masters build.
> Living contracts: [contracts.md](contracts.md) · as-built ledger: [grand-masters-summary.md](grand-masters-summary.md).

> Validation draft, 2026-06-25. This is the handoff for a fresh implementation
> context, not yet a hardened entry in [contracts.md](contracts.md). Validate the
> assumptions marked **DECIDE** before treating the checklist as mechanical work.
>
> Implementation pass completed 2026-06-25 for the substrate and listed non-Plan
> controls. Automated tests, type-check, and production build pass; browser/device
> field validation and contract promotion remain open.

## Proposed rule

Every discrete interactive surface on the **glass plane** has a capability-sized
minimum hit target:

| Interaction target mode | Target | Meaning |
| --- | ---: | --- |
| Fine pointer | `3.5u` | Mouse/trackpad-sized glass target |
| Coarse pointer | `7u` | Finger/stylus-sized glass target |

This specifies the **interactive border box**, not the visible glyph. An icon may
remain optically smaller and centred inside the target. A control already larger
than the minimum stays larger.

The rule does not apply to world-plane controls. Timeline atom chips and cards
remain Golshi geometry and are projected by the camera.

### Proposed tokens

```css
:root {
  --glass-target-fine: calc(3.5 * var(--glass-u));
  --glass-target-coarse: calc(7 * var(--glass-u));
  --glass-target: var(--glass-target-fine);
  --glass-control-type-size: calc(var(--glass-target) / 3);
}

:root[data-glass-pointer="coarse"] {
  --glass-target: var(--glass-target-coarse);
}
```

There should be one glass ruler: `--glass-u`. Interaction targets and surface
geometry both derive from it.

Readable text that must scale with the active interaction target, such as an
input inside chrome, consumes `--glass-control-type-size`. That ratio belongs to
the same capability contract as `--glass-target`: fine pointer resolves from the
`3.5u` target, coarse pointer resolves from the `7u` target.

### Canonical glass ruler

The former menubar rail override of `--glass-u` has been removed. It was hidden
per-surface scaling: two elements described as `7u` could resolve to different
physical sizes depending on their ancestor. Constrained surfaces now keep the
canonical ruler and must fit through layout rather than silently changing scale.

`--glass-u-device-calibration` remains as the root device-calibration/measurement bridge used
by fixed chrome calculations; `--glass-u` is the single public surface unit.

- [x] Inventory every assignment to `--glass-u` outside the root declaration.
- [x] Remove local `--glass-u` overrides, beginning with the menubar rail.
- [x] Make constrained surfaces fit through layout, reflow, or an alternate
  representation rather than a private unit scale.
- [x] Rename `--glass-u-base` to `--glass-u-device-calibration` so the bridge's job is explicit.
- [ ] Collapse `--glass-u-device-calibration` and `--glass-u` into one canonical public unit if
  no remaining measurement bridge requires both names.
- [x] Add a guard that rejects non-root declarations of `--glass-u`.

### Capability policy

The qualitative source is
[`capabilities.ts`](../horsetrader.site/js/src/ui/caps/capabilities.ts).
The application should derive one stable document-level mode from its live
`CapabilityStore`, set it at startup, and update it if capabilities change:

```ts
type GlassPointer = "fine" | "coarse";

function glassPointer(caps: Capabilities): GlassPointer {
  return caps.pointer;
}

document.documentElement.dataset.glassPointer = glassPointer(capabilities.get());
capabilities.subscribe((caps) => {
  document.documentElement.dataset.glassPointer = glassPointer(caps);
});
```

The attribute belongs on `document.documentElement`, rather than `#app`, because
alerts and other glass roots may be mounted under `body`.

Target sizing follows the **primary pointer**, not the mere presence of a
touchscreen. A mouse/trackpad-first touch laptop therefore keeps fine targets.
Its dense, often high-resolution display is already accounted for by Darley's
resolution of the single global `--glass-u`; `anyCoarse` must not independently
inflate the interface.

`anyCoarse` remains useful evidence that touch is available, but it does not
select interaction target size. This intentionally supersedes the current
`Capabilities.anyCoarse` comment claiming that touch-target sizing applies
whenever it is true; that comment must be corrected during implementation.

No viewport, orientation, phone/tablet class, or Trainer presentation mode takes
part in this decision. A landscape phone still has a coarse pointer; an iPad on
the rail still has coarse targets.

## How the token applies

The target is a minimum, with a small number of control shapes:

| Shape | Sizing rule |
| --- | --- |
| Square icon control | `inline-size` and `block-size: var(--glass-target)` |
| Text/action button | `min-block-size: var(--glass-target)`; width remains content or layout driven |
| Field | `min-block-size: var(--glass-target)` |
| Full-row choice/tile | `min-block-size: var(--glass-target)`; the complete row is the hit target |
| Checkbox | the labelled wrapper gets the minimum; the visual box does not become `7u` |
| Range | expand the interactive wrapper/track lane to the minimum; the painted track and thumb remain optical sizes |
| Existing large tile | verify that its complete hit box exceeds the minimum; do not force it down to the token |
| Dense collection | reflow or choose an alternate coarse representation if `7u` items no longer fit; do not overlap or shrink targets |

Where padding and border already make a control larger than the target, prefer
`min-*` over assigning an exact size. Exact `3.5u`/`7u` is for intentionally
square icon controls.

## Implementation task list

### 1. Substrate

- [x] Add `--glass-target-fine`, `--glass-target-coarse`, and
  `--glass-target` to `horsetrader.site/css/glass.css`.
- [x] Add a pure `glassPointer(caps)` policy beside the capabilities module, with
  tests for desktop, phone, iPad, and hybrid touch-laptop profiles.
- [x] Correct the stale `Capabilities.anyCoarse` comment so it no longer claims
  that any available touchscreen selects coarse target sizing.
- [x] In `app.ts`, stamp and reactively maintain
  `data-glass-pointer="fine|coarse"` on `document.documentElement`.
- [x] Add a guard proving the tokens are derived from `--glass-u` and that
  both target modes remain present.
- [ ] After field validation, promote this draft into a numbered contract in
  `contracts.md`.

### 2. Persistent glass chrome

| Class | Control | Proposed application | Notes |
| --- | --- | --- | --- |
| `.menubar__home` | Home icon | exact square | Known fine baseline is about `2.94u`; migrate to `3.5u`. |
| `.menubar__plan` | Plan icon | exact square | Same shared menubar control form. |
| `.menubar__beta` | Beta icon | exact square | Same shared menubar control form. |
| `.menubar__identity` | Trainer pill | minimum block size | Width remains content-driven. Avatar is optical content. |
| `.menubar__balance` | Resource readout | minimum block size | Width remains content-driven. |
| `.search-box__input` | Search field | minimum block size | Confirm coarse expansion still fits the menubar representation. |
| `.search-box__result` | Search result | minimum block size | Complete result row is clickable. |
| `.filmstrip__frame` | Timeline warp face | exact square | Current fine size is `3.75` device-calibrated units; normalising to `3.5u` is a small reduction. Six-plus `7u` frames may require coarse scrolling/packing review. |

- [x] Migrate shared `.menubar__button` geometry where possible, with pill
  exceptions remaining width-driven.
- [ ] Audit the search result popup at both target modes.
- [ ] Audit filmstrip packing and scrolling at coarse `7u`.

### 3. Unified Trainer

| Class | Control | Proposed application | Notes |
| --- | --- | --- | --- |
| `.mobile-trainer__back` | Back icon | exact square | |
| `.mobile-trainer__portrait` | Oshi chooser | verify only | Already a large tile; the pencil is not the target. |
| `.mobile-trainer__club` | Club chooser | minimum block size | Complete card/row is clickable. |
| `.mobile-trainer__name` | Trainer name field | minimum block size | |
| `.mobile-trainer .playstyle-preset` | Play-style icon | exact square | This is the reference coarse `7u` control. Fine becomes `3.5u`, not permanently `7u`. |
| `.checkbox` | Labelled toggle | minimum block size | Keep `.checkbox__box` optical. |
| `.discrete-slider__control` | Slider interaction lane | minimum block size | Prefer sizing the wrapper, not inflating `.discrete-slider__range` artwork. |
| `.mobile-trainer__action` | Apply/Discard | minimum block size | Includes quiet/apply modifiers. |
| `.cloud-controls__btn` | Cloud/Sync | minimum block size | |

- [x] Replace the Trainer's local hard-coded `7u` preset target with the global
  target token.
- [x] Verify six coarse presets still fit the `50u` iPad rail.
- [ ] Verify fine presets at `3.5u` do not make their glyphs visually cramped;
  glyph size remains independently tuned.
- [ ] Verify checkbox `2 × 3` phone and `3 × 2` broad layouts after target sizing.
- [x] Verify range dragging has a full target-sized lane without a `7u` thumb.

### 4. Standard surface controls

| Class | Control | Proposed application | Notes |
| --- | --- | --- | --- |
| `.collapse-pill` | Surface collapse/dismiss | exact square for `--up`; minimum block size for horizontal pill | Direction variants may need separate rules. |
| `.resources-surface__edit` | Record Balance | minimum block size | |
| `.confirm__btn` | Alert action | minimum block size | Root-level capability attribute is required here. |
| `.onboarding__skip` | Tour skip | minimum block size | |
| `.onboarding__next` | Tour next | minimum block size | |
| `.beta-surface__run` | UmaMark action | minimum block size | |
| `.beta-surface__chip` | First-run selector | minimum block size | |
| `.beta-surface__cancel` | Close action | minimum block size | |

- [x] Normalise the shared `surfaceCancel` products through their concrete
  classes or a common action class.
- [x] Check collapse-pill direction variants rather than assuming one geometry.

### 5. Plan surface

> **Deferred.** This surface is currently in flight. Do not migrate or redesign
> its interaction geometry during the first target-normalisation pass. Apply the
> glass target contract when the new Plan representation settles.

| Class | Control | Proposed application | Notes |
| --- | --- | --- | --- |
| `.plan-commit` / `.plan__badge` | Date/pity button | exact square | Current fine baseline is `3.625u`. |
| `.plan .atom-chip--compact` | Planned atom button | exact square | Glass use of a normally world-styled component; scope this rule to `.plan`. |
| `.plan__note` | Note textarea | minimum block size | It will normally exceed one target. |
| `.plan__cancel` | Cancel | minimum block size | |
| `.plan__update` | Update | minimum block size | |

**DECIDE — coarse Plan representation.** A row of several `7u` cells may no
longer fit the current dense Desk layout. This should trigger reflow or a coarse
representation, not target shrinkage. The implementation context should stop
and design that layout if the existing row cannot preserve target separation.

- [ ] After the Plan surface settles, convert its final cell geometry to the
  target contract.
- [ ] Then test the densest final Plan row under coarse targets before accepting
  the layout.

### 6. Oshi and Club selectors

| Class | Control | Proposed application | Notes |
| --- | --- | --- | --- |
| `.oshi-selector__search` | Oshi search | minimum block size | |
| `.oshi-selector__option` | Character tile | verify only | Whole tile is already large. |
| `.oshi-selector__costume` | Costume tile | verify only | Whole tile is already large. |
| `.oshi-selector__cancel` | Cancel | minimum block size | |
| `.oshi-selector__ok` | Apply | minimum block size | |
| `.club-selector__name` | Club name field | minimum block size | |
| `.club-selector__option` | Rank choice tile | minimum block size / verify | Preserve complete-tile hit area; coarse mode may reflow columns. |
| `.club-selector__leave` | Leave club | minimum block size | |
| `.club-selector__cancel` | Cancel | minimum block size | |
| `.club-selector__ok` | Apply | minimum block size | |

- [x] Measure existing large option tiles and mark them compliant without
  resizing if already above the minimum.
- [x] Verify Club rank-grid column count at coarse size.

### 7. Cloud flows

| Class | Control | Proposed application | Notes |
| --- | --- | --- | --- |
| `.cloud-provider__option` | Provider choice | minimum block size | Complete row is the radio target. |
| `.cloud-provider__cancel` | Cancel | minimum block size | |
| `.cloud-conflict__option` | Cloud/local choice | minimum block size | Complete row is the radio target. |
| `.cloud-conflict__btn` | Cancel/Resolve | minimum block size | Includes primary modifier. |

- [ ] Verify provider and conflict rows remain readable rather than merely
  acquiring empty height.

### 8. Resource editor

| Class | Control | Proposed application | Notes |
| --- | --- | --- | --- |
| `.resource-field__input` | Resource number field | minimum block size | |
| `.resources-editor__daily-pack > input[type="checkbox"]` | Daily Pack / Training Pass | wrapper target required | Native inputs currently have no dedicated class. Prefer making the complete labelled row clickable. |
| `.resources-editor__pack-days` | Pack days field | minimum block size | |
| `.resources-editor__cancel` | Cancel | minimum block size | |
| `.resources-editor__save` | Save | minimum block size | |

- [x] Add a stable class or labelled wrapper for the two native checkbox
  controls; do not rely permanently on a structural selector.
- [x] Ensure clicking the label row toggles the native checkbox.

### 9. Commitment dossier and card surface

| Class | Control | Proposed application | Notes |
| --- | --- | --- | --- |
| `.commit-dossier__card-inspect` | Featured-card tile | verify only | Already large. |
| `.commit-dossier__step` | Pity minus/plus | exact square | |
| `.commit-dossier__cancel` | Cancel | minimum block size | |
| `.commit-dossier__save` | Save | minimum block size | |
| `.card-surface__fav` | Favourite icon | exact square | |
| `.card-surface__note-input` | Note textarea | minimum block size | Normally larger. |
| `.card-surface__link` | External/reference link | minimum block size | May need `inline-flex` to create a real hit box. |
| `.card-surface__cancel` | Cancel | minimum block size | |
| `.card-surface__update` | Update | minimum block size | |

- [x] Verify large dossier tiles rather than shrinking them.
- [x] Check whether the card link should remain inline text or become a
  target-sized action row.

## Explicitly outside this pass

These are interactive, but are not discrete glass buttons governed by this
contract:

- timeline `.atom-chip`, `.commitment-badge`, `.banner__commit-badge`, and
  `.rushed-toggle`: world-plane Golshi geometry;
- timeline cards and banners: world objects, not glass controls;
- camera pan, wheel/pinch zoom, minimap drag/seek, and slider value tracks:
  continuous interaction regions requiring their own gesture/track audit;
- visual children such as avatars, portraits, icon images, checkbox boxes, and
  slider thumbs: content inside a target, not independent targets.

The exception worth repeating is `.plan .atom-chip--compact`: its class comes
from a world component, but its instance is mounted on the glass Plan surface,
so only that scoped instance joins this migration.

## Acceptance pass

- [ ] Fine profile resolves every discrete glass target to at least `3.5u`.
- [ ] Coarse profile resolves every discrete glass target to at least `7u`.
- [x] Changing capability state updates existing and newly mounted surfaces.
- [x] Glyphs and decorative children are not needlessly enlarged to target size.
- [ ] No coarse layout overlaps, clips, or silently shrinks a target.
- [ ] Keyboard focus remains visible on every migrated control.
- [x] Disabled controls retain their target geometry.
- [x] World controls retain Golshi/world sizing and camera membership.
- [ ] iPhone Safari, iPad Air landscape, and desktop Chrome are field checked.

## Assumptions awaiting validation

1. `3.5u` and `7u` are minimum **border-box hit targets**, not universal visual
   control dimensions.
2. Square icon controls use exact target dimensions; text, fields, rows, and
   tiles use minimum block size.
3. The Plan and filmstrip may need coarse-specific reflow; preserving their
   current density is not permission to shrink the targets.
4. Continuous gesture regions are a separate survey rather than being forced
   into a square-button abstraction.
