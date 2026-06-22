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
import type { CalendarDate } from "../../core/projection/dates.ts";
import { focusIndex } from "../select/filmstrip.ts";
import type { FilmFrame } from "../select/filmstrip.ts";

/** Frame edge (px) and the gap between frames — the equidistant step. The strip's
 *  whole claim is uniform spacing, so these are the time-compression constant. */
const FRAME_PX = 48;
const GAP_PX = 12;
const STEP_PX = FRAME_PX + GAP_PX;

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
  const fill = portrait
    ? h("img", { class: "filmstrip__portrait", attr: { src: portrait, alt: f.atom?.name ?? "", loading: "lazy", draggable: false } })
    : f.atom
      ? null
      : h("div", { class: "filmstrip__star", attr: { "aria-hidden": "true" } }, "☆");
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
 *  their own spacing inside. Positioned by the same index geometry `settle` uses,
 *  painted under the frames. */
function buildCapsules(frames: readonly FilmFrame[]): HTMLElement[] {
  return runs(frames).map((run) => {
    const left = run.start * STEP_PX;
    const width = (run.len - 1) * STEP_PX + FRAME_PX;
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
  // The frames the last refresh built, and the last view date — kept so a refresh
  // can re-settle the strip under the read-head without waiting for the next pan.
  let frames: readonly FilmFrame[] = [];
  let viewDate: CalendarDate | null = null;

  const track = h("div", { class: "filmstrip__track" });
  const head = h("div", { class: "filmstrip__head" }); // the fixed read-head line
  const el = h("section", { class: "filmstrip", attr: { "aria-label": "Favourites" } }, track, head);

  /** Translate the track so frame `i` centres under the read-head (the strip's
   *  midline). The frames are equidistant, so the offset is pure index arithmetic. */
  const settle = () => {
    if (viewDate === null || frames.length === 0) return;
    const i = focusIndex(frames, viewDate);
    if (i < 0) return;
    const centreX = el.clientWidth / 2;
    const frameCentre = i * STEP_PX + FRAME_PX / 2;
    track.style.transform = `translateX(${centreX - frameCentre}px)`;
  };

  return {
    el,
    refresh(next) {
      frames = next;
      el.classList.toggle("filmstrip--empty", frames.length === 0);
      // Capsules paint first → under the frames they outline.
      track.replaceChildren(...buildCapsules(frames), ...frames.map((f) => frameEl(f, onWarp)));
      settle();
    },
    setView(date) {
      viewDate = date;
      settle();
    },
  };
}
