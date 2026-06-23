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
import { formatDate } from "../../format.ts";
import { surfaceActions } from "./surfaceActions.ts";
import { compactForecast } from "../widgets/forecast.ts";
import type { PlanRow } from "../../select/plan.ts";

const KIND_LABEL: Record<PlanRow["kind"], string> = { trainee: "Trainee", support: "Support" };

export interface PlanSurfaceOpts {
  rows: PlanRow[];
  onClose: () => void;
}

function planRow(row: PlanRow): HTMLElement {
  return h(
    "li",
    { class: "plan__row" },
    h("span", { class: `plan__band pity-band--${row.band}` }, KIND_LABEL[row.kind]),
    h("span", { class: "plan__label" }, row.label),
    h("span", { class: "plan__window" }, `${formatDate(row.start)} – ${formatDate(row.end)}`),
    h("span", { class: "plan__pity" }, `${row.pity}★`),
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
    h("ul", { class: "plan__rows" }, ...opts.rows.map(planRow)),
    surfaceActions(
      h("button", { class: "plan__close", attr: { type: "button" }, on: { click: opts.onClose } }, "Close"),
    ),
  );
}
