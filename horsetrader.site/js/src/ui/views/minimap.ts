/**
 * The minimap — the consolidated balance instrument and the primary navigation
 * (ui.md "The minimap, consolidated"; it replaced the old horizontal navbar). A
 * fixed bottom strip showing the timeline's whole semantics in miniature: the
 * carat **balance** line (blue ≥ 0, red < 0), pity **frets**, favourite **dots**,
 * and a centred **window** you grab to navigate.
 *
 * It is **another view over the one ledger + fold** (architecture.md) — no second
 * engine. The carat-domain logic is the pure `select/minimap.ts`; this file owns
 * the measured width, the minimap-scale axis, and the DOM/SVG. Interaction is the
 * two-way cheap-path binding with the timeline: dragging the track seeks
 * (`onSeek` → the timeline's `centerOn`), and a pan pushes the view date back here
 * (`setView`) — neither path broadcasts, so 60 Hz navigation stays off the render
 * path (docs/frontend/interaction.md, the two-tier change model).
 */

import "./minimap.css";

import { h } from "../h.ts";
import { createAxis } from "../axis.ts";
import type { Axis } from "../axis.ts";
import { daysBetween } from "../../core/projection/dates.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";
import { balancePoints, caratToY, fretLevels, dotMarks } from "../select/minimap.ts";
import type { BalanceSeries } from "../../core/projection/ledger.ts";
import type { Bundle } from "../bundle/access.ts";
import type { Commitments, Favourites } from "../../core/persistence/document.ts";

const SVG_NS = "http://www.w3.org/2000/svg";

/** The window's width (px) — a comfortable grab handle, *not* a to-scale viewport
 *  mirror (ui.md: "sized for the hand"). Tunable by eye. */
const WINDOW_PX = 56;

/** What `refresh` needs to repaint — the same projection + bundle the canvas reads. */
export interface MinimapRefresh {
  series: BalanceSeries;
  bundle: Bundle;
  favourites: Favourites;
  commitments: Commitments;
  extent: readonly [CalendarDate, CalendarDate] | null;
  now: CalendarDate;
}

export interface Minimap {
  /** The always-mounted strip. */
  readonly el: HTMLElement;
  /** Repaint line/frets/dots for the current projection + extent — the render path. */
  refresh(p: MinimapRefresh): void;
  /** Move the window to centre on `date` — the cheap path (a pan pushed this here). */
  setView(date: CalendarDate): void;
}

export interface MinimapHandlers {
  /** Fired as the user drags the track — the date to navigate to (→ `centerOn`). */
  onSeek(date: CalendarDate): void;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

interface MinimapPoint {
  x: number;
  y: number;
  carats: number;
}

function splitAtThreshold(a: MinimapPoint, b: MinimapPoint, threshold: number): MinimapPoint[] {
  const da = a.carats - threshold;
  const db = b.carats - threshold;
  if (da === 0 || db === 0 || Math.sign(da) === Math.sign(db)) return [a, b];
  const t = (threshold - a.carats) / (b.carats - a.carats);
  return [
    a,
    {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      carats: threshold,
    },
    b,
  ];
}

export function minimap({ onSeek }: MinimapHandlers): Minimap {
  // The minimap-scale axis the last refresh built (full extent → strip width), and
  // the extent itself — kept for `setView` and for hit-testing a seek.
  let axis: Axis | null = null;
  let extent: readonly [CalendarDate, CalendarDate] | null = null;

  // Back-to-front: the sign-tinted background bands, then the frets, then the
  // white balance line. The line itself stays white (an instrument needle); the
  // *background* carries the sign — blue while healthy, red on a deficit.
  const bands = svg("g", { class: "minimap__bands" });
  const frets = svg("g", { class: "minimap__frets" });
  const line = svg("path", { class: "minimap__line", fill: "none" });
  const canvas = svg("svg", { class: "minimap__canvas", preserveAspectRatio: "none" });
  canvas.append(bands, frets, line);

  const dots = h("div", { class: "minimap__dots" });
  const window = h("div", { class: "minimap__window" });
  const today = h("div", { class: "minimap__today" }); // the white "now" orientation marker
  const el = h("section", { class: "minimap", attr: { "aria-label": "Minimap" } }, today, window, dots);
  el.append(canvas); // the SVG mounts under the chrome (today/window/dots draw over it)

  /** Centre the window on a content-x, clamped to stay fully on the track. */
  const placeWindow = (x: number) => {
    const max = Math.max(0, el.clientWidth - WINDOW_PX);
    window.style.left = `${Math.max(0, Math.min(max, x - WINDOW_PX / 2))}px`;
  };

  // --- navigation: a press/drag anywhere on the track seeks to that date. The
  // window itself isn't moved here — `onSeek → centerOn` round-trips back through
  // `setView`, so the timeline pan stays the single source of truth. ---
  let seeking = false;
  const seekTo = (clientX: number) => {
    if (!axis || !extent) return;
    const x = clientX - el.getBoundingClientRect().left;
    const date = axis.dateForX(x);
    onSeek(date < extent[0] ? extent[0] : date > extent[1] ? extent[1] : date);
  };
  el.addEventListener("pointerdown", (ev) => {
    seeking = true;
    el.setPointerCapture(ev.pointerId);
    el.classList.add("minimap--grabbing");
    seekTo(ev.clientX);
  });
  el.addEventListener("pointermove", (ev) => seeking && seekTo(ev.clientX));
  const end = (ev: PointerEvent) => {
    if (!seeking) return;
    seeking = false;
    el.releasePointerCapture(ev.pointerId);
    el.classList.remove("minimap--grabbing");
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);

  return {
    el,
    refresh({ series, bundle, favourites, commitments, extent: nextExtent, now }) {
      extent = nextExtent;
      dots.replaceChildren();
      if (!extent) {
        axis = null;
        frets.replaceChildren();
        bands.replaceChildren();
        line.removeAttribute("d");
        today.style.display = "none";
        return;
      }

      const width = el.clientWidth;
      const height = el.clientHeight;
      // The viewBox is the pixel box; preserveAspectRatio="none" lets it stretch.
      canvas.setAttribute("viewBox", `0 0 ${width} ${height}`);

      const days = Math.max(1, daysBetween(extent[0], extent[1]));
      axis = createAxis({ origin: extent[0], pxPerDay: width / days });

      // Frets — a horizontal line per pity boundary across the band.
      frets.replaceChildren(
        ...fretLevels().map((carats) => {
          const y = caratToY(carats, height);
          return svg("line", {
            class: carats === 0 ? "minimap__fret minimap__fret--origin" : "minimap__fret",
            x1: 0, x2: width, y1: y, y2: y,
          });
        }),
      );

      // The balance line stays white; the *background* carries pressure from
      // the origin fret. Blue fills the above-origin lane when the plan is
      // positive; red fills the below-origin lane when the plan is negative.
      const pts = balancePoints(series, extent).map((p) => ({ x: axis!.xForDate(p.date), y: caratToY(p.carats, height), carats: p.carats }));
      const originY = caratToY(0, height);
      const bandShapes: SVGRectElement[] = [];
      let d = "";
      for (let i = 0; i < pts.length - 1; i++) {
        const segments = splitAtThreshold(pts[i]!, pts[i + 1]!, 0);
        for (let j = 0; j < segments.length - 1; j++) {
          const a = segments[j]!;
          const b = segments[j + 1]!;
          const midpoint = (a.carats + b.carats) / 2;
          if (midpoint > 0) {
            bandShapes.push(svg("rect", {
              class: "minimap__band minimap__band--positive",
              x: a.x, y: 0, width: Math.max(0, b.x - a.x), height: originY,
            }));
          } else if (midpoint < 0) {
            bandShapes.push(svg("rect", {
              class: "minimap__band minimap__band--negative",
              x: a.x, y: originY, width: Math.max(0, b.x - a.x), height: height - originY,
            }));
          }
        }
        const a = pts[i]!;
        const b = pts[i + 1]!;
        d += `${i === 0 ? "M" : "L"} ${a.x} ${a.y} L ${b.x} ${b.y} `;
      }
      bands.replaceChildren(...bandShapes);
      line.setAttribute("d", d.trim());

      // The white "now" line — a fixed orientation marker (the minimap doesn't
      // pan, so today sits at a constant x across the whole extent).
      today.style.display = "";
      today.style.left = `${axis.xForDate(now)}px`;

      // Dots — favourited future banner appearances; the bookmarks' list-twin.
      dots.replaceChildren(
        ...dotMarks(bundle, favourites, commitments, now).map((m) =>
          h("div", { class: `minimap__dot minimap__dot--${m.kind} minimap__dot--${m.state}`, attr: { style: `left:${axis!.xForDate(m.date)}px` } }),
        ),
      );
    },
    setView(date) {
      if (!axis) return;
      placeWindow(axis.xForDate(date));
    },
  };
}
