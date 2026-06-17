# Trackblazer Zoom

Status: scope draft.

Zoom is the scaling lever the culling spine left open (see [design.md](design.md)
Zoom + Outcome). It is **optical scale**: an aerial map where the user changes
apparent altitude (`z`). The world layout never changes — zoom is a camera
transform over fixed packed bounds, no repack, no re-measure, no relayout.

## Model

The camera today is one line in `timeline.ts`:

```text
content.transform = translate(panX, panY)
```

Zoom adds a scalar:

```text
content.transform = translate(panX, panY) scale(z)        z ∈ [zMin, zMax]
```

Because `scale` is applied to `content`, it reaches exactly what lives inside
content — the cards and the in-world markers — and **cannot** reach anything
mounted as a sibling. That is the whole constraint satisfied by construction.

Coupling to accept: optical scale ties "how much time is on screen" to "how big
the cards are." Zoom in → less time visible *and* larger cards (art + text scale
up). That is the aerial-map model; the alternative (see more time at fixed card
size) is a relayout and is explicitly out of scope.

## What scales, what doesn't

Inside `content` (scales as terrain):

- the positioned cards;
- `.timeline__line` (home row) and `.timeline__today` — world markers;
- the card stems/struts.

Outside `content` (furniture, untouched for free — already siblings):

- the minimap, menubar, bookmarks drawer, shields/overlays;
- `.timeline__rail` (the centre-line band + groove) — tuned by eye, not zoomed;
- the scenario art — static wallpaper behind the world.

### Infinitely-thin elements

A strut is conceptually a 1px tick; the home row a thin rule. Their **position and
length** scale with the world, but their **thickness must not** — a uniform
`scale(z)` would fatten a 1px strut to `z` px. Pin the cross-axis dimension with a
counter-scale:

- set `--zoom: z` as a custom property on `.timeline__content` (alongside the
  transform);
- thin elements pin thickness with `calc(1px / var(--zoom))` (e.g.
  `.timeline__line { height: calc(2px / var(--zoom)); }`, the stem width likewise).

`length / number = length` is valid CSS, so the element renders at a constant
screen thickness at every altitude (`z=2` → 0.5px content → 1px screen; `z=0.5` →
2px → 1px). No clamp needed. The today dot is a feel call: pin it as a
constant-size map marker, or let it scale — decide by eye.

The rail band and scenario wallpaper are furniture and need none of this.

## The conversion spine

Most of the work is one contained refactor in `timeline.ts`: every screen↔content
mapping currently assumes `scale = 1`. Introduce two helpers and route the inlined
conversions through them:

```text
screenToContentX(sx) = (sx - panX) / z
contentToScreenX(cx) = panX + z * cx
```

Sites to thread `z` through:

- `centerX = clientWidth/2 - panX`  →  `(clientWidth/2 - panX) / z`;
- `targetPanForDate = clientWidth/2 - axis.xForDate(date)`  →  `… - z*axis.xForDate(date)`;
- `panBounds.min = clientWidth - content.offsetWidth`  →  `clientWidth - z*offsetWidth`;
- `reconcile` window edges — divide the overscan span by `z` (content-space window
  is `clientWidth / z` wide).

The axis primitive (`xForDate` / `dateForX`) is **untouched** — it works in content
space and never needs to know `z`. The `setScene` bounds measurement is likewise
camera-independent (content space) and stays as-is.

## Anchor (zoom under cursor / pinch centre)

Keep the content point under the cursor fixed across a zoom step:

```text
cx   = screenToContentX(cursorX)        // before
panX = cursorX - z' * cx                // after, for the new z'
```

## Vertical

Uniform scale, but the centre line must stay pinned to the rail furniture under
zoom. Set `transform-origin: 0 50%` on `content` so vertical scaling pivots about
the centre line (the rail sits at viewport-centre); horizontal anchoring is handled
by the `panX` recompute above, so horizontal origin stays at the left edge.

The peek well's depth bounds (`aboveDepth` / `belowDepth`) become `z * depth` — the
visible vertical extent scales with the world.

## Bounds

- **zMin (zoom out)** = the altitude where the full timeline *height* fits the
  viewport. There is no reason to pull back further than "the whole thing fits."
- **zMax (zoom in)** = enough to make cards readable.

These nearly meet — the range is narrow. Because of that the live set grows only
modestly at full zoom-out, so zoom needs **no separate perf wall** and does **not**
reopen the LOD/imposter branch ([considered.md](considered.md)): the fit-to-height
floor keeps the live set affordable on its own. Where exactly the two bounds land
is unknown until tuned by eye, but the span is small.

## Input

- **Ctrl/Cmd + wheel** on the timeline — trivial: one listener, anchor at the
  pointer.
- **Pinch** (two-pointer) — the real work: two-pointer tracking that must coexist
  with the existing single-pointer pan/capture state machine; derive `z` from the
  pointer-distance ratio, anchor at the midpoint.

## Mid-gesture raster

A continuous `scale()` re-rasterizes text each step. Covered by the
readability-ceiling principle: mid-pinch the user is not reading, so allow text to
go slightly soft during an active gesture (`will-change: transform`) and snap crisp
on settle — the same cover the warp path uses.
