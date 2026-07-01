# Godolphin inputs — responsive surface migration notebook

> Working field log, started 2026-06-25. This records what we learn while
> converting existing desktop-native glass surfaces into intentional responsive
> representations. It is evidence for a later design contract, not yet that
> contract.
>
> Related:
> [godolphin-findings.md](godolphin-findings.md) holds the original device study;
> [glass-interaction-targets.md](glass-interaction-targets.md) holds the target
> sizing migration; [contracts.md](contracts.md) is where stable rules eventually
> graduate.

## Why this notebook exists

The existing UI grew desktop-first and largely by local judgement. Making it
responsive is not a matter of shrinking the same windows. Each pass is exposing
decisions about capability, representation, interaction, typography, visual
language, browser behaviour, and modality that should become shared design
guidelines once enough surfaces have been migrated.

The method is:

1. Take one real surface through the complete desktop ↔ touch transition.
2. Tune it on real hardware rather than deriving taste from screenshots alone.
3. Record successful patterns, rejected approaches, and remaining uncertainty.
4. Repeat on several surfaces.
5. Distil only the repeated, field-proven patterns into contracts.

## Session 1 — Unified Trainer

### Starting point

The Trainer had become a unified responsive surface, but much of its geometry
still carried desktop assumptions:

- interaction targets varied by component;
- the coarse play-style presets were permanently `7u`, while desktop presets
  were sparse little squares in a wide rail;
- the menubar identity chip treated its portrait as fixed optical content;
- the Trainer had acquired a generic title bar and duplicated name editor;
- its Apply/Discard footer used one responsive layout everywhere;
- active/selected play styles used broad green fills;
- opening child modals dimmed the complete glass pane, damaging its frost;
- iOS could double-tap or focus-zoom controls and leave the visual viewport
  magnified.

The pass deliberately used this one surface as a proof point for broader glass
and responsive rules.

## 1. Capability chooses interaction geometry

The app now derives a document-level glass pointer mode from the **primary
pointer**:

```text
fine primary pointer   → 3.5u minimum target
coarse primary pointer → 7u minimum target
```

The mode is stamped as `data-glass-pointer="fine|coarse"` on
`document.documentElement` and updates reactively when capability changes.

Important calls:

- A touch-capable laptop with a mouse primary remains fine.
- `anyCoarse` records that touch exists but does not inflate the whole UI.
- Pointer mode is independent of viewport shape and Trainer presentation.
- A landscape phone is still coarse; a large iPad rail is still coarse.
- Root placement matters because some glass surfaces mount outside `#app`.

This produced shared `--glass-target-fine`, `--glass-target-coarse`,
`--glass-target`, and target-derived `--glass-control-type-size` tokens.

### One ruler means one ruler

The menubar rail previously overrode `--glass-u` to `0.8×` its root value. That
made two nominal `7u` controls physically different depending on ancestry. The
override was removed and a guard now rejects non-root `--glass-u`
declarations.

Constrained surfaces must fit through layout, reflow, scrolling, or alternate
representation—not private rulers.

## 2. Target size and optical content are separate

The target contract applies to the interactive border box. Glyphs, portraits,
checkbox boxes, and slider thumbs remain optical content within it.

This distinction was essential in the Trainer:

- coarse play-style buttons retain a `7u × 7u` jab target;
- their icons remain independently eye-tuned;
- checkbox wrappers grow, not the checkbox artwork;
- the slider lane grows, not its thumb;
- the menubar portrait can scale and translate optically without changing its
  button geometry.

The menubar portrait demonstrated that optical tuning may legitimately differ by
pointer mode:

- mouse keeps a compact identity portrait and dropdown cue;
- touch spends more of the `7u` target on the 128×128 portrait;
- touch removes the chevron because the chip is a direct jab target, not a
  desktop-style dropdown affordance;
- the portrait may use a mode-specific `transform` for final eye tuning while
  layout and hit testing stay unchanged.

The portrait inset is derived from target minus portrait size, so top, bottom,
and leading clearance remain equal before any deliberate optical nudge.

## 3. Dense controls may change shape without changing rhythm

Six `3.5u` desktop squares fitted the row but looked sparse. Making them simply
larger would have confused mouse and touch density.

The settled play-style representation is:

```text
fine pointer:   six 7u × 3.5u horizontal keys
coarse pointer: six 7u × 7u square jab targets
```

Both rows occupy `42u`. This preserves the same broad packing rhythm while
allowing different control shapes.

On fine pointers, the original `3.5u` target becomes the left cell of each
button. The icon stays centred in that cell and the entire right cell is kept
clear. The icon was reduced to `2.5u`, giving approximately equal inset above,
below, and left. That empty second cell then became useful state-display space.

This is a promising pattern:

> A responsive control can preserve a stable internal cell while gaining a
> capability-specific secondary cell.

It avoids both “stretch the icon to fill the new button” and “centre everything
again and lose alignment.”

## 4. Applied state and inspected selection are different

The desktop play-style keys now borrow the visual language of hi-fi equipment:

- the **applied** preset has a green pilot LED in the empty right cell;
- the **selected/inspected** preset has a green luminous outline;
- broad green background fills were removed;
- the large detail icon uses the same luminous outline rather than a green slab.

Touch cannot use the desktop LED cell because its target remains square. It uses
the same premium luminous-edge language for active/selected state, without the
green fill.

Selection behaviour was simplified after trying a separate “no inspection
focus” state:

1. Trainer opens with the applied preset selected.
2. Tapping another preset selects and previews it.
3. Tapping the currently selected preset again returns selection to the applied
   preset.
4. The LED continues to identify the applied setting independently.

This retains a useful distinction without introducing a third invisible state.

## 5. Responsive representation is not uniform resizing

### Header

The generic “Trainer” title bar was removed. It was information-free chrome and
reintroduced a title-bar language previously removed elsewhere.

The top strip now contains the editable trainer name itself:

- no duplicate name card remains in the body;
- no “Trainer Name” label is shown—the owner knows what their own name is;
- fullscreen mobile retains a back arrow because the menubar is absent;
- rail presentation hides the back arrow because the menubar remains the route
  home.

The same DOM composition serves both presentations, but presentation policy
controls whether navigation is needed.

### Footer actions

The Record Balance surface established the desktop action grammar: compact,
centred, content-width actions rather than a full-width split bar.

Trainer now uses:

- fullscreen/portrait: two equal-width full-row actions;
- desktop rail: a compact centred pair.

Equal widths matter on portrait, where the footer itself is the visual language.
Content-width matters on desktop, where full-width actions read as oversized.

Disabled Discard and Apply use the same `not-allowed` cursor language as disabled
Sync.

### Child modal locking

The original Trainer lock applied opacity and grayscale to the complete
`.mobile-trainer`. In Chromium this composited the pane itself, fading its
backdrop filter and fill until the rail appeared fully transparent.

The corrected rule:

- the glass container keeps its material;
- header, body, and footer content are dimmed;
- pointer interaction remains locked at the parent.

Modality should suspend content, not destroy the material representation of the
surface behind it.

## 6. Browser-native touch behaviour is part of responsive design

Two iOS behaviours appeared on the Trainer:

1. double-tapping a button zoomed the page;
2. focusing the trainer-name input zoomed the visual viewport, which remained
   magnified after leaving the field.

The proof-point fix is:

- Trainer controls use `touch-action: manipulation`, removing double-tap zoom
  while preserving deliberate pinch zoom;
- the trainer name consumes a semantic
  `--ht-type-editable-title-size`;
- on coarse pointers that token derives from one-third of the `7u` target,
  keeping editable title text readable at the phone glass-unit floor without a
  component-local pixel exception.

This corrected an initially too-local solution (`max(16px, …)` in Trainer CSS).
The browser constraint is real, but the answer belongs in the typography
vocabulary rather than scattered component exceptions.

The same rule now covers the menubar. Search inherits the menubar's
`--menubar-control-type-size`, which aliases Godolphin's
`--glass-control-type-size`: one third of the current `--glass-target`. The
desktop bar therefore uses the fine target ratio, and the phone bar uses the
coarse target ratio so the search field stays above the iOS focus-zoom floor.

Open work:

- survey all remaining text inputs, textareas, and selects;
- decide which semantic editable-text roles need the same coarse floor;
- decide whether `touch-action: manipulation` graduates from the Trainer proof
  point to a general glass-control rule;
- keep user pinch zoom available unless field evidence gives a compelling reason
  otherwise.

## 7. Debug instruments are temporary scaffolding

A live size-debug panel was useful while comparing:

- icon dimensions;
- target dimensions;
- resolved `glass-u`;
- viewport and DPR.

Once the geometry was field-settled, the panel and its measurement/observer code
were removed completely rather than hidden. Instrumentation should leave no
permanent runtime loop merely because it helped the migration.

## 8. Wider glass-target migration completed alongside Trainer

The session began as a general interaction-target pass and migrated the listed
non-Plan glass controls:

- persistent menubar controls, search, and filmstrip;
- Trainer fields, choices, checkboxes, slider lanes, and cloud actions;
- common surface actions and collapse controls;
- Oshi/Club selectors;
- cloud provider/conflict flows;
- resource editor inputs and labelled checkbox rows;
- dossier/card actions.

Large existing tiles were verified rather than shrunk. World-plane controls were
left on Golshi geometry. The Plan surface remains deliberately deferred while
its representation is in flight.

Coarse target growth also forced honest surrounding layout:

- menubar height reserves its larger controls;
- filmstrip height reserves `7u` frames;
- the aperture’s bottom-chrome reservation follows the larger filmstrip;
- the rail no longer appears to fit by secretly shrinking its ruler.

## 9. Things tried and corrected

These corrections are worth preserving because they reveal the design boundary:

- **Tried:** permanent `7u` play-style squares everywhere.  
  **Corrected:** capability-specific shape; same `42u` row rhythm.

- **Tried:** centre icons in newly doubled desktop buttons.  
  **Corrected:** preserve the original left target cell; reserve the right cell.

- **Tried:** active green background fill.  
  **Corrected:** LED + luminous edge; state without a slab.

- **Tried:** no selected preset on open, with detail shown independently.  
  **Corrected:** applied is selected on open; repeated selection returns home.

- **Tried:** generic title and separate trainer-name card.  
  **Corrected:** the editable name is the header content; no redundant label.

- **Tried:** one full-width footer ratio in every presentation.  
  **Corrected:** equal full-width portrait pair; compact desktop pair.

- **Tried:** dim the entire locked Trainer.  
  **Corrected:** dim content, preserve glass material.

- **Tried:** component-local `16px` input fix.  
  **Corrected:** semantic editable-title typography derived from glass geometry.

## Candidate guidelines — not contracts yet

These have survived one complete surface pass and should be tested against later
surfaces:

1. Capability selects target geometry; viewport selects representation.
2. Target geometry and optical content are separate systems.
3. Preserve stable internal alignment cells when controls change shape.
4. Use secondary space to communicate state, not to enlarge decoration.
5. Applied state, staged selection, focus, and disabled state need distinct
   visual jobs.
6. A responsive surface may share content while changing navigation and action
   grammar by presentation.
7. Persistent surrounding chrome must reserve the real target size.
8. Lock content without fading the glass material that contains it.
9. Browser-native focus, keyboard, and zoom behaviour are design inputs.
10. Encode platform constraints in semantic tokens before adding local numeric
    exceptions.
11. Remove redundant title bars; let editable identity or useful action occupy
    the premium top strip.
12. Temporary field instrumentation should be deleted once its decision is
    captured.

## Next passes

Useful future surfaces for testing and extending these candidates:

- Resources + Record Balance: read/edit representation and portrait unfolding;
- Oshi and Club selectors: dense tile reflow, modal containment, and text input;
- Card detail: quick glance versus sustained text editing;
- Cloud provider/conflict: modality and complete-row choices;
- Plan: dense desktop cells versus a genuine coarse representation;
- Search: keyboard entry while persistent chrome remains present.

Expected later synthesis:

- typography roles and minimum editable sizes;
- responsive action-row grammar;
- title/header policy;
- state-language vocabulary;
- focus and keyboard reconciliation;
- dense-control reflow patterns;
- modality/material rules;
- a repeatable checklist for porting the remaining desktop-native surfaces.

## Session 2 — Card detail (existing-surface port)

### Why this surface

Trainer was a greenfield recomposition. Card detail is the first true port: an
existing shared trainee/support surface whose semantics, staged editing, and
desktop composition already work. It is deliberately simpler than Trainer, but
it tests whether the emerging rules can absorb existing UI without replacing it.
The trainee form is the denser case because it adds three four-slot aptitude
axes; support cards continue through the same renderer.

### First cut — explicit wrapper policy and semantic type

The card had a special modal width selected indirectly with
`:has(> .surface__body > .card-surface)`. On a phone that `34u` intrinsic width
could outrank the generic mobile modal rule, leaving a narrow desktop card in a
wide viewport. The surface factory now accepts a semantic variant and card
detail requests `surface--card-detail`. The representation can therefore size
its glass wrapper at the wrapper seam without inspecting descendants or leaking
card selectors into the generic surface router.

The first port also:

- composes the card name from Tosen `headline-text`;
- composes the note from `normal-text + edit-control`, so only the actual editor
  receives the coarse browser floor and focus-scoped writing assistance;
- gives surface actions the shared `focus-text` treatment;
- removes hover `scale()` from the favourite star—glass hover feedback may use
  light/material treatment, but cannot borrow the world camera's projection;
- gives coarse-pointer phone extent the available portrait sheet width while
  preserving the existing shared content and staged-write behavior.

The first narrow composition was intentionally conservative: art and identity
remained side by side, aptitudes remained four columns, and the note simply
consumed the available width. Field review immediately falsified the wrapper
policy around it:

- portrait still sat beneath the menubar and clipped, so card detail is a true
  fullscreen document there, above persistent chrome, with its action docked at
  the bottom;
- landscape remained a tiny height-led card despite abundant inline room, so it
  stays modal but uses the viewport for width and nearly the full short axis;
- responsive desktop showed the same failure: `glass-u` correctly shrinks with
  limited height, but a modal's useful inline extent cannot therefore be
  derived from `N × glass-u` alone.

The landscape/desktop form now spends its width to reduce height: the intact
art/identity hero occupies one column, while aptitudes and note occupy the
other. Portrait keeps the single reading flow. This is the first clear example
of representation layout being selected by shape while pointer capability
continues to govern target geometry independently.

### Candidate guideline from the port — not yet a contract

> A representation that needs to govern generic surface geometry should declare
> a semantic wrapper variant. Do not infer representation identity from child
> structure or fight generic responsive rules through selector specificity.

> `glass-u` governs dimensional glass objects inside a representation; it does
> not require the representation's viewport allocation to be height-led.
> Modal width may be a bounded viewport policy, especially on short wide views.
