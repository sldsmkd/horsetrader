/**
 * The film strip — the favourites face of The Filing, rendered as a row of frames
 * that scroll past a fixed read-head as you pan the timeline. It is the **ordinal
 * twin of the minimap squares**: the same favourited content (empty square) and
 * committed banners (filled square), but laid out by *sequence* — equidistant,
 * earliest-to-latest — instead of by calendar distance. The dead stretches between
 * far-apart wants collapse out; what you read is "where am I in my list", not "when".
 *
 * Like the minimap it is a passive cheap-path consumer: `refresh` rebuilds the
 * frames on the render path; `setView` slides the strip so the frame nearest the
 * view centres under the read-head, on every 60 Hz pan, with no broadcast. The
 * strip→timeline coupling (click to warp / open a card) is deliberately NOT wired
 * yet — this is the conceptual pass: prove the follow + the compression first.
 *
 * The carat-domain logic is the pure `select/filmstrip.ts`; this file owns the
 * frame width, the read-head, and the glide.
 */

import "./filmstrip.css";

import { h } from "../h.ts";
import { resolveLengthPx } from "../glassUnit.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";
import { focusIndex } from "../select/filmstrip.ts";
import type { FilmFrame } from "../select/filmstrip.ts";

/** The strip's geometry rides the glass plane (Grand Masters): the frame edge and
 *  gap are `--glass-u-base` multiples declared in the CSS (`--fs-frame`/`--fs-gap`),
 *  so the strip scales with the chrome tier instead of pinning device px. The view
 *  resolves them to px (the calibration bridge) on every refresh — i.e. on resize —
 *  and the equidistant-step math reads the resolved values, never a literal. */
interface Metrics {
  frame: number;
  step: number;
}

export interface Filmstrip {
  /** The always-mounted strip. */
  readonly el: HTMLElement;
  /** Rebuild the frames for the current favourites — the render path. */
  refresh(frames: readonly FilmFrame[]): void;
  /** Slide the strip so the view-nearest frame sits under the read-head — cheap path. */
  setView(date: CalendarDate): void;
}

export interface FilmstripHandlers {
  /** Clicking a face warps the timeline to that banner's appearance date. */
  onWarp(date: CalendarDate): void;
}

/** One frame — just the face (or the square for an art-less favourite / a commit).
 *  The outline is always the banner capsule behind it, never the frame itself, so a
 *  lone favourite and a banner's pair read as the same kind of object. */
function frameEl(f: FilmFrame, onWarp: (date: CalendarDate) => void): HTMLElement {
  const portrait = f.atom?.image ?? null;
  const cls =
    `filmstrip__frame filmstrip__frame--${f.kind} filmstrip__frame--${f.state}` +
    (f.past ? " filmstrip__frame--past" : "") +
    (portrait ? " filmstrip__frame--portrait" : "");
  // No favourite on this banner (a bare commitment) → an outline star placeholder:
  // a prompt to go star whoever you're pulling for. A favourite always has an atom.
  let fill: HTMLElement | null;
  if (portrait) {
    const img = h("img", {
      class: "filmstrip__portrait",
      attr: { src: portrait, alt: f.atom?.name ?? "", loading: "lazy", draggable: false },
    }) as HTMLImageElement;
    // Fuji-Kiseki stage magic: fade each face in as it *decodes* rather than letting it snap.
    // The capsule blocks + the 160ms glide stay crisp (the nice feedback); only the icon pop —
    // whose timing is unbounded (cache/network) so no fixed curtain can catch it — gets masked.
    // A cached image is already `complete`, so it reveals synchronously before first paint → no
    // transition, instant. A first-load image starts at opacity 0 (CSS) and fades on `load`.
    const reveal = () => img.classList.add("filmstrip__portrait--loaded");
    if (img.complete) reveal();
    else img.addEventListener("load", reveal, { once: true });
    fill = img;
  } else {
    fill = f.atom ? null : h("div", { class: "filmstrip__star", attr: { "aria-hidden": "true" } }, "☆");
  }
  return h("div", { class: cls, attr: { title: f.atom?.name ?? "" }, on: { click: () => onWarp(f.date) } }, fill);
}

/** A contiguous run of same-banner frames — the unit the strip groups. */
interface Run {
  start: number;
  len: number;
  frame: FilmFrame;
}

/** Split the flat frame list into runs of the same banner (`group`). Frames from
 *  one banner are already contiguous, so a single forward pass finds the runs. */
function runs(frames: readonly FilmFrame[]): Run[] {
  const out: Run[] = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    if (i > 0 && f.group === frames[i - 1]!.group) out[out.length - 1]!.len++;
    else out.push({ start: i, len: 1, frame: f });
  }
  return out;
}

/** The banner capsules — one rounded rectangle per banner (the strip's only
 *  outline). A lone favourite is a one-wide capsule; a banner with several is a
 *  wider one wrapping its faces, so they read as one pull's twofer while keeping
 *  their own spacing inside. Positioned by the same index geometry `settle` uses
 *  (off the resolved unit metrics), painted under the frames. */
function buildCapsules(frames: readonly FilmFrame[], m: Metrics): HTMLElement[] {
  return runs(frames).map((run) => {
    const left = run.start * m.step;
    const width = (run.len - 1) * m.step + m.frame;
    return h("div", {
      class:
        `filmstrip__capsule filmstrip__capsule--${run.frame.band}` +
        (run.frame.past ? " filmstrip__capsule--past" : "") +
        (run.frame.heat > 0 ? ` filmstrip__capsule--hot filmstrip__capsule--hot-${run.frame.heat}` : ""),
      attr: { style: `left:${left}px;width:${width}px` },
    });
  });
}

export function filmstrip({ onWarp }: FilmstripHandlers): Filmstrip {
  // The frames the last refresh built, the last view date, and the unit metrics
  // resolved at that refresh — kept so `setView` (the per-pan cheap path) re-settles
  // off cached values without forcing a layout, while a refresh (incl. resize) picks
  // up the live glass unit.
  let frames: readonly FilmFrame[] = [];
  let viewDate: CalendarDate | null = null;
  let metrics: Metrics = { frame: 0, step: 0 };

  const track = h("div", { class: "filmstrip__track" });
  const head = h("div", { class: "filmstrip__head" }); // the fixed read-head line
  const el = h("section", { class: "filmstrip", attr: { "aria-label": "Favourites" } }, track, head);

  /** Translate the track so frame `i` centres under the read-head (the strip's
   *  midline). The frames are equidistant, so the offset is pure index arithmetic
   *  off the resolved unit metrics. */
  const settle = () => {
    if (viewDate === null || frames.length === 0 || metrics.step === 0) return;
    const i = focusIndex(frames, viewDate);
    if (i < 0) return;
    const centreX = el.clientWidth / 2;
    const frameCentre = i * metrics.step + metrics.frame / 2;
    track.style.transform = `translateX(${centreX - frameCentre}px)`;
  };

  return {
    el,
    refresh(next) {
      frames = next;
      // Resolve the frame + gap off the live glass unit (the calibration bridge) —
      // a refresh is a view change (resize/recompute), the right cadence for this.
      const frame = resolveLengthPx(el, "var(--fs-frame)");
      metrics = { frame, step: frame + resolveLengthPx(el, "var(--fs-gap)") };
      el.classList.toggle("filmstrip--empty", frames.length === 0);
      // Capsules paint first → under the frames they outline.
      track.replaceChildren(...buildCapsules(frames, metrics), ...frames.map((f) => frameEl(f, onWarp)));
      settle();
    },
    setView(date) {
      viewDate = date;
      settle();
    },
  };
}
