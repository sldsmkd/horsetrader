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
import { formatMonthDay, formatYear, possessive } from "../../format.ts";
import { surfaceActions } from "./surfaceActions.ts";
import { compactForecast } from "../widgets/forecast.ts";
import { planCommit } from "../widgets/planCommit.ts";
import { atomChip, type FavouriteBinding, type InspectBinding } from "../widgets/atomChip.ts";
import { NOTE_MAX_LENGTH } from "../../../core/persistence/validate.ts";
import type { PlanRow } from "../../select/plan.ts";

export interface PlanSurfaceOpts {
  rows: PlanRow[];
  /** The player — personalises the mast ("Xelene's Plan" beside their oshi's portrait). */
  trainerName: string;
  oshiPortrait: string;
  oshiName: string;
  fav: FavouriteBinding;
  inspect: InspectBinding;
  /** Open the commit dossier for a banner (the Desk swaps itself out for it — the
   *  dossier stays the pity writer; see desk-discovery.md writer/viewer boundary). */
  onEditPity: (key: string) => void;
  /** Commit a banner's note (the *why*), keyed by the banner's stable id; "" clears it. */
  onSetNote: (key: string, text: string) => void;
  onClose: () => void;
}

/** The banner note box — the trainer's *why* on this banner (The Interview), keyed by the
 *  banner id. A textarea that reads as text and commits on blur (Enter blurs, Shift+Enter
 *  keeps the newline); the value is normalised + persisted by the coordinator. */
function noteBox(row: PlanRow, onSetNote: (key: string, text: string) => void): HTMLElement {
  return h(
    "textarea",
    {
      class: "plan__note",
      attr: { placeholder: "Add a note…", maxlength: NOTE_MAX_LENGTH, rows: 3, "aria-label": "Banner note" },
      on: {
        blur: (e) => onSetNote(row.key, (e.target as HTMLTextAreaElement).value),
        keydown: (e) => {
          const ke = e as KeyboardEvent;
          if (ke.key === "Enter" && !ke.shiftKey) {
            ke.preventDefault();
            (ke.target as HTMLTextAreaElement).blur();
          }
        },
      },
    },
    row.note,
  );
}

function planRow(
  row: PlanRow,
  fav: FavouriteBinding,
  inspect: InspectBinding,
  onEditPity: (key: string) => void,
  onSetNote: (key: string, text: string) => void,
): HTMLElement {
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
    // The banner note (the "why") — editable, keyed to this banner.
    noteBox(row, onSetNote),
    h("span", { class: "plan__forecast" }, compactForecast(row.forecast)),
  );
}

/** A year rule between rows — a centred YYYY flanked by hairlines. The dates dropped their
 *  year, so these carry it; one leads each year's first row (the top row included). */
function yearRule(year: string): HTMLElement {
  return h("li", { class: "plan__year" }, year);
}

/** Interleave year rules into the time-sorted rows — one before each year's first banner. */
function rowsWithYears(rows: PlanRow[], opts: PlanSurfaceOpts): HTMLElement[] {
  const out: HTMLElement[] = [];
  let year: string | null = null;
  for (const row of rows) {
    const rowYear = formatYear(row.start);
    if (rowYear !== year) {
      out.push(yearRule(rowYear));
      year = rowYear;
    }
    out.push(planRow(row, opts.fav, opts.inspect, opts.onEditPity, opts.onSetNote));
  }
  return out;
}

export function planSurface(opts: PlanSurfaceOpts): HTMLElement {
  return h(
    "section",
    { class: "plan" },
    h(
      "header",
      { class: "plan__mast" },
      h("img", {
        class: "plan__oshi",
        attr: { src: opts.oshiPortrait, alt: opts.oshiName, loading: "lazy", decoding: "async", draggable: false },
      }),
      h(
        "div",
        { class: "plan__masthead" },
        // Personalised: "Xelene's Plan" / "Kris' Plan" (possessive handles the trailing s).
        h("h2", { class: "plan__title" }, `${possessive(opts.trainerName)} Plan`),
        h("p", { class: "plan__count" }, `${opts.rows.length} planned ${opts.rows.length === 1 ? "banner" : "banners"}`),
      ),
    ),
    h("ul", { class: "plan__rows" }, ...rowsWithYears(opts.rows, opts)),
    surfaceActions(
      h("button", { class: "plan__close", attr: { type: "button" }, on: { click: opts.onClose } }, "Close"),
    ),
  );
}
