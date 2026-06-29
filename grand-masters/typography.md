# Grand Masters — typography architecture

> Working contract, started 2026-06-26. This records the type architecture
> discovered during the first serious mobile presentation pass. It is ready to
> guide implementation, but not yet a numbered invariant in [contracts.md](contracts.md).

## Thesis

Typography belongs to the same two-plane model as geometry.

The app should not carry local font decisions such as "8.8px here" or "0.82rem
there." Components should name the semantic job of the text, and the inheritance
tree should resolve that job through the plane the text lives on.

The rule is:

```text
semantic role × plane root → concrete type geometry
```

So "Rudolf's name on a timeline card" and "Rudolf's name on the filmstrip" can
share one semantic role. They live in different planes, but at the default
timeline camera pose they should read as the same on-screen type.

Name the comparison: **one Rudolf** is the apparent-size equivalence between a
world object and its glass-plane counterpart at the current/canonical timeline
camera pose. If the same character portrait on a timeline card and on the
filmstrip reads as "one Rudolf" apart, equivalent semantic type roles should
also read as equivalent.

## Root reset and inheritance

The implementation should start at the root, not in components:

- establish a reset for margins, box sizing, and inherited UI font defaults;
- set the app's base font family, size, weight, and line-height once;
- make `button`, `input`, `textarea`, and `select` inherit by default;
- put semantic type classes/tokens above component CSS;
- treat local font metrics as exceptions that must justify themselves.

The desired shape is that a component says:

```html
<span class="ht-type-chip-title">Symboli Rudolf</span>
```

not:

```css
font-size: 0.82rem;
font-weight: 700;
line-height: 1.1;
```

Component CSS may still decide layout, truncation, wrapping, opacity, and colour.
It should not normally decide the type scale.

## Plane roots

There are two normal inheritance roots.

### Glass

The glass plane is orthographic and uses the canonical glass unit:

```css
:root {
  --ht-type-u: var(--glass-u);
}
```

Menus, chrome, filmstrip, surface sheets, modals, forms, and alerts resolve their
semantic type roles through this root.

### World

The world plane lives under `.timeline__content`, the same element that receives
the camera transform:

```html
<section class="timeline">
  <div class="timeline__rail"></div>
  <div class="timeline__content">...</div>
</section>
```

The world root should replace the type unit:

```css
.timeline__content {
  --ht-type-u: calc(var(--world-golshi) / 7);
}
```

That expression is the current working bridge:

```text
1 Golshi = 7 world type units
```

At the default/fitted camera pose, this is close enough to the intended frustum
solve that projected world type and glass type can be audited as visually
equivalent.

The visual audit unit is **Rudolf**:

```text
1 Rudolf = apparent equality between equivalent world and glass objects
```

Rudolf is not a layout unit to build dimensions from. It is the field test for
whether the bridge and the camera pose are close enough: zoom until two
equivalent character portraits match by eye, then compare their semantic text.

## Frustum assumption

The full optical model says the world is a parallel plane behind the glass,
viewed through the glass aperture by a head-on pinhole camera. The current
implementation renders that projection as a uniform `scale(z)`.

The future frustum reframe will make this literal:

- the aperture projects into a world-space view rect;
- culling consumes that rect instead of DOM box round-trips;
- default/fitted `z` is a camera result, not an arbitrary scale;
- the relationship between Golshi, glass-u, and projected screen size becomes a
  first-class camera quantity.

For the typography pass, we can pretend that solve already exists. The current
default zoom is close enough for the practical rule:

```text
At default timeline zoom, equivalent semantic roles should match on screen
across glass and world.
```

This lets implementation proceed without blocking on the culling/frustum rewrite.

If the future frustum solve changes the exact camera relationship, Rudolf is the
thing it should preserve: equivalent world and glass signs should still be
auditable by apparent equality at the canonical pose.

## Why not counter-scale text

World text is painted onto world objects. It should project through the camera
with the card, banner, chip, and stem it belongs to.

Do not make ordinary card labels behave like glass overlays by defining world
type as `glass-u / zoom`. That would keep the text screen-stable while its card
moves through the camera, which is the wrong projection idiom for world material.

Counter-scaling remains appropriate for infinitely thin or screen-stable map
markers, like the home row thickness and today dot. It is not the default
typography model.

## Measurement path

The existing expensive timeline path already has a truth-geometry phase:

1. `setCards()` mounts every card.
2. The timeline enters a measurement window.
3. `.timeline__content` renders with effective scale `1`.
4. The packer measures transform-independent layout (`offsetWidth` /
   `offsetHeight`).
5. `setScene()` arms culling while the content is still unscaled.
6. The real camera scale is restored.
7. The card layer is revealed.

This means world type can participate in ordinary layout. Cards are read-only
world signs; edits happen through glass surfaces. The packer should measure the
world geometry that the cards actually occupy, and future frustum culling should
consume those known world bounds directly.

## Semantic inventory method

The font pass should audit text by role, not by current selector.

For each text site, record:

| Question | Meaning |
| --- | --- |
| What semantic role is this? | Body, surface title, panel title, chip title, chip modifier, label, caption, number, editable note, action, etc. |
| Which plane owns it? | Glass or world. |
| Which root resolves it? | `:root` / glass, or `.timeline__content` / world. |
| Should it match an equivalent role across planes at default zoom? | Usually yes for semantic UI labels and names; no for symbolic/debug text. |
| Is it an exception? | Icons, glyph-like text, debug HUD, dense charts, or deliberately optical artwork labels. |

Example classifications:

| Text | Role | Plane |
| --- | --- | --- |
| Filmstrip character name | chip title | glass |
| Timeline atom character name | chip title | world |
| Timeline atom modifier | chip modifier | world |
| Menubar trainer name | control title | glass |
| Menubar search input | control input | glass |
| Surface section heading | label | glass |
| Banner date label | caption/date | world |
| Card detail note textarea | editable note | glass |
| Resource number input | number input | glass |

## Candidate role tree

The current `--ht-type-*` tokens are a useful starting vocabulary, but the pass
should name the roles explicitly and then map them to sizes/weights/lines.

Likely roles:

- `normal-text`
- `body`
- `focus-text`
- `headline-text`
- `surface-title`
- `panel-title`
- `control`
- `action`
- `label`
- `caption`
- `micro`
- `number`
- `number-large`
- `chip-title`
- `chip-modifier`
- `editable-body`
- `editable-note`

Some current tokens may collapse or split once audited. For example, `label` is
currently doing both section-eyebrow work and dense tile work; editable text has
only one special role today, but iOS focus zoom means text inputs, textareas, and
selects need a deliberate semantic floor rather than component-local `16px`
patches.

The menubar is the first shared chrome boundary using Godolphin's input floor.
Its descendants inherit `--menubar-control-type-size`, which aliases the
capability-owned `--glass-control-type-size`. Godolphin decides whether that
ratio resolves from the fine `3.5u` target or coarse `7u` target; typography
only consumes the resulting semantic size.

First surface calibration: Trainer

The Trainer page is the first real surface using the tentative semantic roles
across phone and desktop representations.

| Text | Role |
| --- | --- |
| Trainer name input | `headline-text` + `edit-control` |
| Oshi portrait caption | `focus-text` |
| Club/cloud/section headings | `label` |
| Club name | `focus-text` |
| Discard, Apply | `focus-text` |
| Cloud, Sync | `focus-text` |
| Selected play-style name | `headline-text` |
| Selected play-style motto | `focus-text` |
| Preset description and notes | inherited `normal-text` |
| Checkbox and slider setting names | `control-label` |
| Slider value | `number` |
| Slider helper copy | `caption` |

Trainer name, card detail names such as `Maruzensky`, and the selected
play-style name share the optical `headline-text` role. Editable headlines
compose it with `edit-control`; editability does not create another visual role.

### Focus text

`focus-text` is the first explicitly optical design-language role. It groups
copy that should attract immediate reading attention without claiming to be a
true title: the menubar date, club name, Oshi portrait caption, selected
play-style subtitle, primary surface action text, menubar identity, and menubar
carat readout.

The menubar is a focus band, so it applies the role once at its root. Dates,
identity, search, and balances inherit it rather than restating focus on each
control.

Its size is `1.375` times the presentation type unit:

```css
--ht-type-focus-text-size:
  calc(1.375 * var(--glass-type-presentation-u));
```

This first pass establishes visual language. The grouping may later acquire a
more precise semantic account, but components should share the role rather than
locally tuning these equivalent focus items.

### Headline text

`headline-text` is the principal identifying line within a surface. It names or
summarises the thing currently in focus without becoming oversized display type:
the Trainer name, selected play-style name, card subject name, and projected
carat balance.

The first optical calibration is `1.8` times the same presentation type unit:

```css
--ht-type-headline-text-size:
  calc(1.8 * var(--glass-type-presentation-u));
```

Godolphin owns that presentation ruler independently of control geometry:

```css
:root {
  --glass-type-presentation-u: var(--glass-u);
}

:root[data-glass-pointer="coarse"] {
  --glass-type-presentation-u: calc(1.697 * var(--glass-u));
}
```

The `1.697` coarse calibration preserves the visually approved phone sizes that
were previously emerging accidentally from the control floor. It does not make
the text an edit control and does not alter body copy or labels.

### Editable control floor

Godolphin's coarse control floor is a control capability, not part of any
typographic role. Editable elements opt into it with a second class:

```html
<input class="ht-type-headline-text ht-type-edit-control">
```

The semantic class publishes its natural size. Only the coarse capability rule
may raise that size:

```css
.ht-type-normal-text {
  --ht-type-natural-size: var(--ht-type-normal-text-size);
}

.ht-type-focus-text {
  --ht-type-natural-size: var(--ht-type-focus-text-size);
}

.ht-type-headline-text {
  --ht-type-natural-size: var(--ht-type-headline-text-size);
}

:root[data-glass-pointer="coarse"] .ht-type-edit-control {
  font-size:
    max(var(--ht-type-natural-size, 1em), var(--glass-control-type-size));
}
```

This keeps `focus-text` and `headline-text` visually distinct across
presentations while preventing browser focus zoom only on controls that
explicitly need the floor.

The class also owns focus-scoped browser writing assistance through one
delegated UI handler. Spellcheck is enabled on `focusin` and disabled on
`focusout`, so suggestions remain available during editing without leaving
correction marks on a resting display/edit control. CSS cannot toggle the
native `spellcheck` state; the class is the shared hook for both its CSS and DOM
behaviour.

### Normal text

`normal-text` is the common optical baseline for supporting readable copy:
prose, section labels, captions, checkbox/control labels, ordinary values, and
ordinary menubar/input text. The eye-tested calibration is `1.2` presentation
type units:

```css
--ht-type-normal-text-size:
  calc(1.2 * var(--glass-type-presentation-u));
```

The roles retain their non-size distinctions: labels may be uppercase and bold,
body copy may be regular with a loose line-height, and captions may be quieter.
They no longer acquire unrelated local apparent sizes.

Normal text is inherited from the glass/application root. Components do not
declare a normal font size; they style only a departure such as focus,
headline, weight, casing, color, or a deliberately different line-height:

```css
body {
  font-size: var(--ht-type-normal-text-size);
  font-weight: var(--ht-type-normal-text-weight);
  line-height: var(--ht-type-normal-text-line);
}
```

## Implementation direction

1. Create the root reset and inherited form-control baseline.
2. Introduce semantic type classes/tokens around a single `--ht-type-u`.
3. Put `--ht-type-u: var(--glass-u)` at the glass root.
4. Put `--ht-type-u: calc(var(--world-golshi) / 7)` on `.timeline__content`.
5. Replace component-local font sizes with semantic roles.

## Tosen master styleguide

The proved visual language now lives in `horsetrader.site/css/tosen.css`.
Tosen owns the sanctioned optical tiers:

- inherited `normal-text`;
- `focus-text`;
- `headline-text`;
- compositional `edit-control`.

The public names remain semantic (`--ht-type-*`, `.ht-type-*`); Tosen is the
owner and provenance, not a prefix components need to know. The older
`typography.css` is now the residual specialist inventory -- surface, panel,
chip, micro, and numeric treatments -- to be audited and either promoted into
Tosen or collapsed into inheritance.
6. Keep a small, named exception list for symbolic/debug/sub-token graph labels.
7. Add a guard that rejects raw `rem`, `em`, `px`, and arbitrary `calc(...)`
   font sizes outside approved exception files/selectors.

The implementation should preserve the plane boundary. Glass type is
dimensionally sized by glass-u. World type is world material, derived from
Golshi, and projected by the camera.
