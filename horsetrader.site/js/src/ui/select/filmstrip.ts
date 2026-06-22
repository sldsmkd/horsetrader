/**
 * The film-strip selector (view-model): the *ordinal* twin of the minimap's
 * favourite squares. Where the minimap plots those squares on a **metric** axis
 * (real calendar distance, with the dead stretches between far-apart wants), this
 * surface compresses time to **sequence** — the same squares, equidistant, packed
 * earliest-to-latest. Two orthogonal projections of one favourites map: the
 * minimap answers *"when, to scale"*, the strip answers *"in what order"*.
 *
 * Unlike the minimap dots, the strip spans the **whole timeline**, past included:
 * a favourite or commitment whose window has closed stays in the sequence but is
 * marked `past` (the view greys it). The strip is the one place the past still
 * earns a frame — it's a record of the whole plan, not just the road ahead.
 *
 * Pure and DOM-free — it knows the frames and which one your view sits nearest,
 * nothing about pixels. The view owns the frame width, the read-head, and the glide.
 */

import type { CalendarDate } from "../../core/projection/dates.ts";
import { daysBetween } from "../../core/projection/dates.ts";
import type { Bundle } from "../bundle/access.ts";
import type { Commitments, Favourites } from "../../core/persistence/document.ts";
import type { BannerKind, HeatBand } from "./aboveLane.ts";
import { atomOf, atomImage, bannerHeatBand } from "./aboveLane.ts";
import type { PityBand } from "../views/widgets/pityBand.ts"; // type-only: erased, no CSS side-effect

/** The favourited atom a frame represents — its identity + portrait. The strip is
 *  the *favourites* face, so a frame with a favourite shows that horsegirl/card's
 *  face; a committed banner with no favourited content has no single atom and falls
 *  back to a square. */
export interface FrameAtom {
  id: string;
  name: string;
  image: string | null;
}

/** One film frame — a square, blown up and placed in sequence: its date, kind (→
 *  lane colour), fill state (favourited content vs committed banner), whether its
 *  window has closed (`past` → greyed), and — when it carries a favourite — the
 *  atom whose portrait replaces the square. */
export interface FilmFrame {
  date: CalendarDate;
  kind: BannerKind;
  state: "bookmark" | "commit";
  past: boolean;
  atom: FrameAtom | null;
  /** The banner this frame came from. Frames sharing a `group` are the same
   *  banner's favourites — adjacent in the strip, wrapped by one capsule. */
  group: string;
  /** The banner's commitment band — the capsule colour. The face already says
   *  trainee/support, so the capsule is freed to carry the plan: grey (no
   *  commitment) / green (sensible) / purple (waste) / red (unfundable). The same
   *  rule the commitment badge + dossier use, so the strip agrees with them. */
  band: PityBand;
  /** The banner's heat tier — the face inherits the same lane-coloured glow the
   *  banner card carries (bannerGroup.css `banner--hot-N`). Closed banners are cold. */
  heat: HeatBand;
}

/** The favourited atoms on a banner — every favourited content that resolves (R/1★
 *  are culled by `atomOf`), with portraits, in content order. The strip's unit is
 *  the favourite, so two favourites on one banner are two frames (unlike the
 *  timeline, where the banner is the unit and they collapse to one square). */
function favouritedAtoms(bundle: Bundle, kind: BannerKind, contents: readonly string[], favourites: Favourites): FrameAtom[] {
  const atoms: FrameAtom[] = [];
  for (const id of contents) {
    if (!(id in favourites)) continue;
    const atom = atomOf(bundle, kind, id);
    if (atom) atoms.push({ id, name: atom.name, image: atomImage(bundle, kind, id) });
  }
  return atoms;
}

/**
 * The frames in sequence, across **all** time, sorted earliest to latest. The
 * strip's unit is the **favourited atom**: a banner carrying two favourites emits
 * two frames on the same beat, each with its own portrait — the favourites face
 * shows favourites, not the banners that collapse them. A committed banner with no
 * favourited content still earns one square frame (the commitment as a beat). Keeps
 * the past instead of dropping it, tagging closed windows `past`.
 */
export function filmFrames(
  bundle: Bundle,
  favourites: Favourites,
  commitments: Commitments,
  now: CalendarDate,
  bandFor: (bannerKey: string) => PityBand = () => "empty",
): FilmFrame[] {
  const frames: FilmFrame[] = [];
  for (const ev of bundle.all()) {
    // Stories grant welfare supports — favourited welfare earns a frame too, even
    // though it isn't pullable: a bookmark beat with no commitment band and no heat
    // (it's a grant, not a gacha). Its frame warps to the story that grants it.
    if (ev.type === "story") {
      const past = ev.end < now;
      for (const atom of favouritedAtoms(bundle, "support", ev.contents, favourites)) {
        frames.push({ date: ev.start, kind: "support", state: "bookmark", past, atom, group: ev.key, band: "empty", heat: 0 });
      }
      continue;
    }
    if (ev.type !== "trainee" && ev.type !== "support") continue;
    const committed = ev.key in commitments;
    const past = ev.end < now;
    const band = bandFor(ev.key);
    // Heat inherits the banner card's rule: free-pull value, cold once closed.
    const freePulls = typeof ev.rewards?.pulls === "number" ? ev.rewards.pulls : 0;
    const heat = past ? 0 : bannerHeatBand(freePulls);
    const atoms = favouritedAtoms(bundle, ev.type, ev.contents, favourites);
    if (atoms.length === 0) {
      if (committed) frames.push({ date: ev.start, kind: ev.type, state: "commit", past, atom: null, group: ev.key, band, heat });
      continue;
    }
    for (const atom of atoms) {
      frames.push({ date: ev.start, kind: ev.type, state: committed ? "commit" : "bookmark", past, atom, group: ev.key, band, heat });
    }
  }
  return frames.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The frame the read-head should centre on for a given view date: the one nearest
 * `viewDate` in real time (least day-distance). This is the only place metric time
 * re-enters — to choose *which* frame your view is closest to — after which the
 * strip lays the frames out by sequence alone. Returns -1 when there are no frames.
 */
export function focusIndex(frames: readonly FilmFrame[], viewDate: CalendarDate): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < frames.length; i++) {
    const dist = Math.abs(daysBetween(frames[i]!.date, viewDate));
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}
