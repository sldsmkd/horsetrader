/**
 * The Desk — the plan surface (The Cover, phase 3; twinkle-monthly/cover.md). A
 * centred modal spawned from the menubar's tablet button, the readable rendering of
 * the whole plan: one row per committed banner, sorted along the time spine.
 *
 * This is the discovery-phase *shell* — deliberately minimal (twinkle-monthly/
 * desk-discovery.md): kind, window, the banner's handle, pity, and the affordability
 * band, the same grey/green/purple/red the strip + badge carry. The row will grow
 * what the IA work turns out to need (totals, grouping, in-row detail); for now it
 * stands up the surface + the menubar door + the modal lock, with real rows to react
 * to. Stays in the glass-table language — not a magazine.
 */

import "./planSurface.css";
import "../widgets/pityBand.css"; // the .pity-band--<band> fills, shared with the badge/dossier

import { h } from "../../h.ts";
import { formatMonthDay } from "../../format.ts";
import { surfaceActions } from "./surfaceActions.ts";
import { compactForecast } from "../widgets/forecast.ts";
import { planCommit } from "../widgets/planCommit.ts";
import { atomChip, type FavouriteBinding, type InspectBinding } from "../widgets/atomChip.ts";
import type { PlanRow } from "../../select/plan.ts";

// Placeholder for the not-yet-wired banner note column — a real, fully-expressed planning
// note (~133 chars), sized against the cleat cap (140) so the row eyeballs at true length.
const NOTE_PLACEHOLDER =
  "Drop 200 on Maru, ignore other card and pity her. 1LB usable, there's a selector a few weeks later and can push further in Grand Live";

export interface PlanSurfaceOpts {
  rows: PlanRow[];
  fav: FavouriteBinding;
  inspect: InspectBinding;
  /** Open the commit dossier for a banner (the Desk swaps itself out for it — the
   *  dossier stays the pity writer; see desk-discovery.md writer/viewer boundary). */
  onEditPity: (key: string) => void;
  onClose: () => void;
}

function planRow(row: PlanRow, fav: FavouriteBinding, inspect: InspectBinding, onEditPity: (key: string) => void): HTMLElement {
  return h(
    "li",
    // The kind (trainee/support) reads off the row's left border colour now — the chips
    // already look distinct, so the pill was redundant.
    { class: `plan__row plan__row--${row.kind}` },
    // The commitment leads the row — the banner badge's colour rule, taller, with the start
    // date (month + day) folded inside under the pity number. The badge is the dossier edit
    // entry point; the ring lives on the wrapper (grey currentColor) so the white label can't
    // wash it out, mirroring .banner__commit-badge.
    h(
      "span",
      { class: "plan__badge" },
      planCommit({
        pity: row.pity,
        date: formatMonthDay(row.start),
        unfundable: row.unfundable,
        wasteAbove: row.wasteAbove,
        onOpen: () => onEditPity(row.key),
      }),
    ),
    h(
      "ul",
      { class: "plan__chips" },
      ...row.contents.map((atom) => atomChip(atom, row.kind, fav, inspect, true)),
    ),
    // Placeholder for the banner note (the "why") — a real ~133-char note at the cleat cap
    // (140), half-width, until the notes layer is wired in.
    h("p", { class: "plan__note" }, NOTE_PLACEHOLDER),
    h("span", { class: "plan__forecast" }, compactForecast(row.forecast)),
  );
}

export function planSurface(opts: PlanSurfaceOpts): HTMLElement {
  return h(
    "section",
    { class: "plan" },
    h(
      "header",
      { class: "plan__mast" },
      h("h2", { class: "plan__title" }, "The Plan"),
      h("p", { class: "plan__count" }, `${opts.rows.length} committed ${opts.rows.length === 1 ? "banner" : "banners"}`),
    ),
    h("ul", { class: "plan__rows" }, ...opts.rows.map((row) => planRow(row, opts.fav, opts.inspect, opts.onEditPity))),
    surfaceActions(
      h("button", { class: "plan__close", attr: { type: "button" }, on: { click: opts.onClose } }, "Close"),
    ),
  );
}
