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
import { img } from "../../image.ts";
import { formatMonthDay, formatYear, possessive } from "../../format.ts";
import { surfaceActions } from "./surfaceActions.ts";
import { surfaceCancel } from "./surface.ts";
import { compactForecast } from "../widgets/forecast.ts";
import { planCommit } from "../widgets/planCommit.ts";
import { atomChip, type FavouriteBinding, type InspectBinding } from "../widgets/atomChip.ts";
import { NOTE_MAX_LENGTH, normaliseNote } from "../../../core/persistence/validate.ts";
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
  /** Commit a banner's note (the *why*), keyed by the banner's stable id; "" clears it.
   *  Called once per changed row on Update — the Desk is a staged editor, so editing a note
   *  holds it in the textarea and writes nothing until then. */
  onSetNote: (key: string, text: string) => void;
  /** Live note drafts, keyed by banner id — a caller-owned store that outlives the Desk's
   *  DOM. The Desk spawns the card/dossier, and those `view.set`s rebuild the whole surface;
   *  parking the in-progress notes here (and reseeding from it) keeps a half-typed note from
   *  being lost when a row's chip or pity badge is clicked. Cleared on Update/Cancel. */
  noteDrafts: Map<string, string>;
  onClose: () => void;
}

/** The banner note box — the trainer's *why* on this banner (The Interview), keyed by the
 *  banner id (carried on `data-note-key` so the Desk can collect drafts on Update). A staged
 *  textarea: no commit-on-blur — the value is normalised + persisted only when Update reads
 *  it back — so Enter is an ordinary newline and leaving a row never writes. Edits park in
 *  `drafts` so they survive the rebuild a stacked child triggers; `defaultValue` stays the
 *  as-stored note (the pristine baseline). */
function noteBox(row: PlanRow, drafts: Map<string, string>): HTMLTextAreaElement {
  const ta = h(
    "textarea",
    {
      class: "plan__note",
      attr: { placeholder: "Add a note…", maxlength: NOTE_MAX_LENGTH, rows: 3, "aria-label": "Banner note", "data-note-key": row.key },
      on: {
        input: () => {
          if (normaliseNote(ta.value) === ta.defaultValue) drafts.delete(row.key); // back to baseline ⇒ not a draft
          else drafts.set(row.key, ta.value);
        },
      },
    },
    row.note,
  );
  const draft = drafts.get(row.key);
  if (draft !== undefined) ta.value = draft; // reseed an in-progress edit after a rebuild
  return ta;
}

function planRow(
  row: PlanRow,
  fav: FavouriteBinding,
  inspect: InspectBinding,
  onEditPity: (key: string) => void,
  drafts: Map<string, string>,
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
    noteBox(row, drafts),
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
    out.push(planRow(row, opts.fav, opts.inspect, opts.onEditPity, opts.noteDrafts));
  }
  return out;
}

export function planSurface(opts: PlanSurfaceOpts): HTMLElement {
  // The Desk is a staged editor: every row's note lives in its textarea until Update reads
  // the changed ones back. `section` is built first so the footer can reach the live
  // textareas through it (the buttons are its own children — closures, run on click).
  let section: HTMLElement;
  const noteFields = (): HTMLTextAreaElement[] => [...section.querySelectorAll<HTMLTextAreaElement>(".plan__note")];
  // Pristine ⇒ no row's note has changed (compared normalised, against the as-opened value
  // the textarea keeps in `defaultValue`). Gates the Esc backout, like the other editors.
  const pristine = (): boolean => noteFields().every((ta) => normaliseNote(ta.value) === ta.defaultValue);
  const commit = (): void => {
    for (const ta of noteFields()) {
      if (normaliseNote(ta.value) !== ta.defaultValue) opts.onSetNote(ta.dataset["noteKey"]!, ta.value);
    }
    opts.noteDrafts.clear();
    opts.onClose();
  };
  const discard = (): void => {
    opts.noteDrafts.clear(); // discard the parked drafts
    opts.onClose();
  };

  // The actions reflect the staged notes live: with nothing changed the Desk shows a lone
  // "Close"; the first edit reveals Update and turns that button into a "Cancel" (discard).
  const cancel = surfaceCancel({ class: "plan__cancel", onCancel: discard, escSafe: pristine });
  const update = h("button", { class: "plan__update", attr: { type: "button" }, on: { click: commit } }, "Update");
  const sync = (): void => {
    const clean = pristine();
    update.hidden = clean;
    cancel.textContent = clean ? "Close" : "Cancel";
  };

  section = h(
    "section",
    // A row's note input bubbles to the section, where one listener resyncs the buttons.
    { class: "plan", on: { input: sync } },
    h(
      "header",
      { class: "plan__mast" },
      img(opts.oshiPortrait, { class: "plan__oshi", alt: opts.oshiName, loading: "lazy", decoding: "async", draggable: false }),
      h(
        "div",
        { class: "plan__masthead" },
        // Personalised: "Xelene's Plan" / "Kris' Plan" (possessive handles the trailing s).
        h("h2", { class: "plan__title" }, `${possessive(opts.trainerName)} Plan`),
        h("p", { class: "plan__count" }, `${opts.rows.length} planned ${opts.rows.length === 1 ? "banner" : "banners"}`),
      ),
    ),
    h("ul", { class: "plan__rows" }, ...rowsWithYears(opts.rows, opts)),
    surfaceActions(cancel, update),
  );
  sync(); // open pristine: a lone "Close", Update hidden until an edit
  return section;
}
