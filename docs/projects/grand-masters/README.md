# Grand Masters — building the Mega Dream Supporter

Status: **shipped and integrated (2026-07-03).** All three parts are on `main`.

The living outputs are frontend docs, not this folder:

- [frontend/glass.md](../../frontend/glass.md) — the glass/world/camera contracts
  (C-B*, C-D*), the Golshi world unit, the capability substrate, guard status.
  **Read this before touching the glass/world/camera layer.**
- [frontend/typography.md](../../frontend/typography.md) — the type architecture
  and the Tosen styleguide.

This folder is the project record plus the field evidence behind those contracts:

- [godolphin-findings.md](godolphin-findings.md) — the portrait-iPhone field study
  (F1–F11), the `?caps` capability probe, and the banked (retired) rotation research.
- [godolphin-inputs.md](godolphin-inputs.md) — notebook from porting desktop
  surfaces to responsive representations.
- [mobile-worklog.md](mobile-worklog.md) — the Trainer page, phone takeovers,
  phone timeline chrome, and how the Golshi unit was found.
- [umamark.md](umamark.md) — UmaMark, the deterministic benchmark (run from the
  beta chamber) that settled the blur policy.

The original phase design docs (Byerley Turk, its outstanding-work handoff, Darley
Arabian, Godolphin Barb, the glass-interaction-targets register) were folded into
this page and `glass.md`; they remain in git history (last present at `feacb96`).

## The fiction (and the licence it gives us)

In the Grand Masters scenario the Satono Group builds a VR device — the *Mega
Dream Supporter* — with three support AIs, each named for one of the three founding
sires of the thoroughbred line. The VR hook licensed what the glass-table chrome
and zoom camera were already reaching for: a holographic glass HUD of fixed
transparent panes with the world running underneath.

## Provenance

The post-launch graduation of Debut's parked "floating timeline chrome + mobile"
project ([Debut](../debut/README.md)). Debut floated the chrome and contained the
phone layout as a holding action; Grand Masters picked it up properly.

## The three sires (the phases)

A chain of altitude — each makes the next one's job tractable; none reaches into
the previous one's desk:

- **Byerley Turk** — *order and discipline*. Draws the one coherent representation
  in the abstract: correct *relative to* the unit, never touching a pixel.
- **Darley Arabian** — *bravery*. Grounds that single representation on real
  hardware: px, viewport, what fits, responsive limits.
- **Godolphin Barb** — *affection and love*. Shows a *different* representation
  when a display is too far out for one mapping to serve.

The sires were a reasoning scaffold, not an ownership boundary: the durable
artifacts got renamed by their own physics (Golshi, the capability substrate), and
attributing a file to a sire is archaeology.

## The grounding

Two planes, distinguished by projection:

- **Glass** — orthographic. One fixed coordinate system holding every surface,
  dropdown, modal, and the wallpaper. Size *is* dimension.
- **World** — the timeline, a flat plane under a pan + zoom camera. Because the
  plane is flat and head-on, a uniform `transform: scale(z)` *exactly* emulates a
  perspective camera.

The discipline that falls out: **`scale` is the camera's privilege.** On glass it
is a projection violation, which is why Debut's `--chrome-dropdown-scale: 0.8` jank
was more than cosmetic. Full contracts: [glass.md](../../frontend/glass.md).

## What shipped

| Phase | Commits | Dates |
| --- | --- | --- |
| Byerley | `7b0173e` · `cb46791` · `98ceda6` | 2026-06-20 |
| Darley | `435aa28` · `4f3440a` | 2026-06-20 |
| Godolphin | `8721a5a` … `62674ab` | 2026-06-24 → 07-02 |
| Integration | `feacb96` | 2026-07-03 |

The Godolphin range is a *time window*, not a manifest: UmaMark, the image broker,
onboarding, the `select/` refactor and the film strip rode it too.

### Byerley Turk — the glass substrate

- `css/glass.css`: `--glass-u`, the declared depth ladder `--glass-z-*`, and the
  holographic register every pane frosts from.
- `transform: scale` retired from glass; the whole glass plane (surfaces, widgets,
  chrome offsets, typography) migrated to `N × --glass-u`. World cards excluded.
- **No "shield" type** — one `surface()` with orthogonal *modal-demand* and
  *placement* traits; modality is a lock on the spawn tree. Fixed a latent
  `surface--center` vs `surface--modal` mismatch.
- Reorg/rename: `views/surfaces/`, `views/widgets/`; `overlay()` → `surface()`,
  `shieldOpen/anyShield/setShielded` → `modalOpen/anyModal/setLocked`.

### Darley Arabian — grounding on real hardware

- `ui/glassUnit.ts` — the glass-u → px bridge (`resolveLengthPx`).
- `--glass-u-device-calibration: clamp(7px, min(1svh, 2svw), 20px)` — height-led,
  width-vetoed, px-clamped, on the calm `svh`/`svw`.
- `zMin` derived (fit-to-height); `zMax` stays feel.
- The rail seam made executable: `TRACK_RAIL_VISUAL_PX` deleted,
  `--timeline-rail-height` the single source, guarded by `railSeam.test.ts`.
- Blur policy settled by UmaMark: **keep, always-on**.

### Godolphin Barb — device-specific representation

- `ui/caps/` — the capability store (pointer, hover, touch points, a11y media
  queries; reactive, never polled) plus pure presentation policies over a shared
  `deviceForm` (`phone-portrait | phone-landscape | spacious`).
- **Trainer page** — the portrait prototype tested better than the desktop
  two-window book and became the standard `views/trainer/trainerPage.ts`; the old
  `playStyleMachine.ts`, Trainer Card and drawers were deleted. Spacious viewports
  show it on the menubar rail.
- **Phone takeovers** — Plan/Desk, Record Balance, Resources and the commit
  dossier take the full viewport above all chrome on phones; desktop stays modal.
- **Phone timeline chrome** — portrait: film strip only; landscape: minimap only
  and no menubar; no scenario wallpaper on phones.
- **Golshi** (`--world-golshi: 35px`) — the world-plane interaction unit.
- Glass interaction targets — `--glass-target` (fine `3.5u` / coarse `7u`) keyed on
  the primary pointer.

### Integration phase (closed 2026-07-03)

- `deviceForm.ts` extracted (the touch-first predicate had been copy-pasted into
  all five policies).
- C-B4 guard (`glassDimensional.test.ts`) — caught and fixed one live `scale(1.3)`
  on the menubar avatar.
- A11y capabilities left **dormant** by decision; target-token migration verified
  complete; empty `views/mobile/` and the spent branch removed.
- **Self-owned orientation (rotation) retired** — the takeovers made phones usable
  without it. Design record kept in [glass.md](../../frontend/glass.md) and
  [godolphin-findings.md](godolphin-findings.md).

## Still open, by design

- **Fast-pan card churn** — accepted (iPhone ~44fps on a worst-case fling);
  Trackblazer pooling stays parked.
- **Safe-area insets as an aperture field** — gated on `viewport-fit=cover`, which
  was tried and reverted on device; takeovers hand-apply safe-area padding.
- **C-B6 culling exception** — gated on a real-device repro; intended fix is the
  frustum reframe.
