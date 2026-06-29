# Mobile worklog

> Field notebook for the first Godolphin alternate surface: a standalone portrait
> Trainer page built alongside the existing desktop-first Trainer Card. This is
> evidence and build history, not yet the final mobile contract.

## Frame

The work began from the portrait-phone findings in
[godolphin-findings.md](godolphin-findings.md): desktop surfaces were being
resized into a narrow viewport even though their spatial model no longer held.
The proof point deliberately does **not** replace the desktop representation.
It asks whether Trainer identity and Play Style become a better portrait form
when composed as one continuous page.

The governing sire cut remains:

- **Byerley** supplies the dimensional glass language and the one `--glass-u`
  abstraction.
- **Darley** resolves that abstraction onto real hardware in CSS pixels.
- **Godolphin** chooses and builds the alternate portrait representation when
  the desktop spatial form stops serving.

## Build: standalone portrait Trainer

Built the proof point as `ui/views/mobile/mobileTrainerPage.ts`; after field
testing established that it was the better general representation, it became the
standard `ui/views/trainer/trainerPage.ts`.

The page:

- is a full-height, native-scrolling portrait document;
- combines Trainer identity and Play Style rather than opening a second window;
- keeps Oshi, Club, and Cloud on their existing small modal flows;
- stages preset/settings locally and writes through the existing identity
  controller on Apply;
- has a fixed header and sticky Apply/Discard footer;
- stages Play Style locally rather than requiring a presentation state machine.

The first field-test door was a temporary phone button beside Identity.

### Promotion to the standard Trainer — 2026-06-25

The unified page tested better than the desktop two-window surface book, so the
standard Identity item now opens it and the temporary phone button is gone.

Presentation is selected downstream of the capability substrate:

- coarse primary pointer + no hover + touch points, with viewport short edge
  `≤600px` → fullscreen;
- tablet extent or fine-pointer desktop → constrained glass window on the left
  menubar dropdown rail.

This is the intended Godolphin/Darley composition: capabilities answer *can/what
kind*, viewport extent answers *how large*, and the policy chooses the form. The
old `playStyleMachine.ts`, Trainer Card, second Play Style window, drawers, and
height-matching book were removed from the application.

### iPad Air landscape correction

An iPad Air at `1180 × 820` CSS px has enough aperture for the timeline and both
surface groups simultaneously. The non-phone policy was therefore sharpened
from generic "floating" to **menubar rail**:

- Trainer anchors to the rail's left edge;
- Resources remains independently anchored to the right edge;
- the timeline remains visible and live between/behind them;
- Trainer is constrained to `50u`, wide enough to keep six `7u` play-style
  targets on one row at the measured iPad unit (`8.2px`).

The policy vocabulary is now `rail | fullscreen`, which describes the actual
representation rather than merely saying what it is not.

## Shared Play Style content

The desktop Play Style window originally owned both the setting inventory and
its accordion rendering. Those concerns were separated:

- `playStyleSettingsModel.ts` owns the four sections and typed entries.
- `playStyleSettings.ts` builds the shared sliders and checkbox controls.
- Desktop still composes those controls into drawers because its second window
  is vertically constrained.
- Portrait composes the same controls as permanently expanded sections in normal
  document flow.

The shared inventory remains:

| Section | Decisions |
| --- | ---: |
| Participate | 9 |
| Engage | 4 |
| Challenge | 3 |
| Compete | 3 |

An executable test guards the inventory and immutable setting updates.

## Field-led refinements

### State language: selected versus active

The first portrait pass exposed an existing ambiguity in the preset buttons.
The green border correctly read as **selected for inspection**, while green fill
correctly read as **active/applied**. When both states named the same preset the
button showed both signals, muddying their meanings.

The language is now:

- selected only → green outline;
- active only → green fill with quiet grey edge;
- selected + active → green fill with quiet grey edge; no redundant outline.

This correction applies to the shared preset styling, including desktop.

### Presets became icon navigation

Once the selected style's complete mast and explanation sat immediately below
the preset grid, the buttons' repeated name and caption became redundant. The
portrait selector was reduced to one row of six icon-only touch targets. The
buttons retain their accessible names and state attributes.

### Checkbox gates became a responsive matrix

The desktop model groups checkbox gates into rows for its drawer layout. A first
phone rule forced each row to one column, producing six tall single-item rows.

Portrait now promotes the individual checkbox controls into one section grid:

- broad aperture → three columns, commonly `3 × 2`;
- phone aperture → two columns, commonly `2 × 3`;
- graded sliders span the complete row beneath them.

This keeps the gates bundled without crushing their labels.

## Happy accident: a candidate mobile icon standard

The six-icon selector landed with unusually convincing proportions before a
formal mobile icon scale had been chosen. Treat that as a measurement opportunity,
not yet a standard by proclamation.

The page now carries a temporary **SIZE DEBUG** readout immediately below the
selector. It measures the browser's painted geometry:

- selector icon width/height in CSS px;
- selector touch-target width/height in CSS px;
- locally resolved `--glass-u` and `--glass-u-device-calibration` in CSS px;
- icon and target dimensions expressed as multiples of `glass-u`;
- viewport CSS dimensions and device-pixel ratio.

The readout uses Darley's existing CSS→device bridge (`glassUnitPx` /
`resolveLengthPx`) rather than parsing the unresolved custom-property expression.
This is precisely the legitimate seam described in
[darley-arabian.md](darley-arabian.md): CSS owns the mapping, while JS observes
the physical quantity the browser actually resolved.

### Expected phone inference

The current Darley expression is:

```css
--glass-u-device-calibration: clamp(7px, min(1svh, 2svw), 20px);
```

On the measured iPhone's narrow portrait aperture, the result is expected to sit
at or very near the calibrated **7 CSS px floor**. The selector currently asks
for a `2.75rem` icon inside a minimum `3.5rem` square target. The live readout
will tell us their actual Safari geometry and, crucially, their emergent ratios
to the resolved unit.

Do not copy the expected numbers into tokens until the device read is captured.
The useful possible outcome is two standards, not one:

1. the **graphic/icon box**;
2. the larger **touch target** surrounding it.

If the measured ratios land cleanly and continue to feel right, migrate those
dimensions from accidental `rem` values to explicit `N × --glass-u` mobile
tokens. That would turn the happy accident into Byerley-disciplined geometry,
grounded by Darley's device evidence and adopted by Godolphin's alternate forms.

### First device read — iPhone Safari, 2026-06-25

Measured portrait aperture: `390 × 699` CSS px at DPR `3`.

| Quantity | CSS px | Resolved unit |
| --- | ---: | ---: |
| `--glass-u` | 7.0 | `1u` |
| `--glass-u-device-calibration` | 7.0 | `1u` |
| Selector target width | 53.7 | `7.67u` |
| Selector target height | 56.0 | `8.00u` |

So the strongest accidental standard is already visible: **the mobile touch
target's authoritative dimension is `8u` / `56 CSS px`**. Its width is currently
slightly narrower because six equal columns negotiate the available 390px
portrait row; that `7.67u` is layout residue, not a good token candidate.

The first icon reading reported `0 × 0`. The icon was visibly painted, so this
was diagnostic timing rather than geometry: iOS Safari supplied the first probe
before the image's decoded layout was measurable. The probe now retries briefly
and listens for image load before accepting a zero. Capture the corrected icon
measurement on the next device refresh before naming the graphic-box token.

### Touch-target calibration call

For the next field pass the selector targets are deliberately fixed to
**`7u × 7u`**. At the measured phone floor (`1u = 7 CSS px`) that is
`49 × 49 CSS px`. The six-column row no longer decides their dimensions; it
distributes the remaining inline space between six honest square targets.

This is a calibration experiment for a possible global minimum touch-icon box,
not yet a locked system token. The inner bitmap size is incidental and may vary
with the source asset/downsampling.

## Button-like control survey — highlighted desktop screenshot

The marked screenshot contains eight highlighted loci but only six control
forms. Two circles pick out sub-images inside the same timeline atom-chip button;
the image itself is not a separate hit target.

| Highlight | Actual control / visible part | Declared size | Glass-u reading |
| --- | --- | --- | --- |
| Menubar house | Home button (`.menubar__home`) | `2.94u` width, `2.94u` minimum height | **`2.94u × ≥2.94u`** |
| Menubar trainer face | Identity button (`.menubar__identity`); circle marks its avatar | button minimum height `2.94u`; avatar `2.38u` square; button width content-driven, max `15u` | **target: variable × ≥2.94u**; visible avatar **`2.38u²`** |
| Banner trainee face | Leading portrait inside full timeline atom chip | chip height `2.4rem`; portrait fills that height as a square | **not invariant in glass-u** — world-plane control, camera-scaled |
| Banner support-type pip | Trailing attribute image inside the same full atom chip | same chip target; pip fills chip height as a square | **not a separate target**; same world-plane caveat |
| Plan-row content face | Compact atom-chip button in the Desk (`.plan .atom-chip--compact`) | `--plan-cell: 3.625u`, square | **`3.625u²`** |
| Plan-row coloured date/pity box | Plan commitment button (`.plan__badge` / `.plan-commit`) | same `--plan-cell: 3.625u`, square | **`3.625u²`** |
| Filmstrip grey face | Filmstrip frame button (`.filmstrip__frame`) | `--fs-frame: 3.75` device-calibrated units, square | **`3.75²` device-calibrated units** |
| Filmstrip coloured face | Same filmstrip frame in a different commitment state | same | **`3.75²` device-calibrated units** |

### World-plane conversion

The timeline atom chip and banner commitment badge deliberately do not measure in
glass-u. They are children of the camera-transformed world:

- full atom-chip target: `2.4rem` high;
- its portrait and full-height type pip: `2.4rem` square;
- banner commitment target: `2.5rem` square.

Their current screen-space ratio is therefore:

```text
screen-u = (declared CSS px × camera zoom z) / resolved glass-u px
```

There is no single lawful glass-u number without also recording `z`. Converting
them to a fixed glass-u target would change their plane membership and make them
screen-fixed controls on a camera-scaled card — a separate design decision, not
a unit tidy.

### Survey signal

### Fine-pointer baseline versus coarse-pointer form

These controls were built desktop-first, so this table is the emerging
**fine-pointer register**, not evidence that `3–4u` is universally sufficient:

- menubar square: `2.94u`;
- filmstrip frame: `3.75u`;
- Desk icon/date controls: `3.625u`.

They assume mouse/trackpad precision and often rely on hover. The Trainer
experiment establishes a separate coarse-pointer candidate:

- touch-icon target: `7u × 7u`;
- inner image: asset-dependent and not part of the target standard.

The intended system is therefore capability-sensitive rather than one global
physical size:

| Input form | Candidate square target tier |
| --- | ---: |
| Fine pointer / hover | approximately `3–3.75u` |
| Coarse pointer / no hover | `7u` |

This does not mean every existing control should grow globally. It means
Godolphin may supply a coarse-pointer representation at `7u` while the same
semantic control retains its dense fine-pointer form.

### Unit migration rule from the survey

Convert a dimension to glass-u when the control belongs to the orthographic
glass plane:

- menubar controls — already glass-u;
- filmstrip — already `glass-u-device-calibration`;
- Desk compact atom and commitment cells — migrated from `2.9rem` to
  **`3.625u`** during this survey.

Do **not** mechanically convert controls inside timeline cards. Full atom chips
(`2.4rem`) and banner commitment badges (`2.5rem`) belong to the camera-scaled
world plane. Their rem dimensions are world geometry; expressing them in
glass-u would incorrectly move screen-space policy into the model railway.

## Third happy accident: the Golshi world unit

The interaction survey revisited the atom chip's legacy `2.4rem` height. Because
it used content-box sizing, its visible outer target was about `40.4px`. A
temporary border-box comparison at `35px` felt better.

That accepted interaction target divided the existing card geometry exactly:

| World object | Size | Golshi |
| --- | ---: | ---: |
| Atom-chip target | 35px | `1g` |
| Compact below card | 140px | `4g` |
| Full below card | 280px | `8g` |
| Individual above banner | 280px | `8g` |

The temporary comparison therefore graduated into:

```css
--world-golshi: 35px;
--timeline-card-w: calc(8 * var(--world-golshi));
```

Atom chips now use `height: var(--world-golshi)` with `box-sizing:
border-box`; compact below cards remain half the full card by derivation.

The name is canonically **Golshi**, after Gold Ship—the least stable cast member
becoming one of the most stable constants in the engine, which is frankly the
only thematically acceptable outcome.

Golshi is not a replacement for glass-u:

- glass-u sizes the orthographic interface against real hardware;
- Golshi sizes interaction surfaces inside the camera-scaled timeline world.

An executable guard (`ui/worldUnit.test.ts`) protects `1g = 35px`, `full = 8g`,
`compact = 4g`, and the atom chip's 1g target.

## Current validation

At the end of this worklog pass:

- TypeScript check passes;
- the frontend bundle builds;
- all 39 tests pass;
- the portrait Trainer remains a test scaffold reached through the temporary
  menubar button.
