/**
 * The Resources surface: a pure **read** of your account. It answers the one
 * question the player asked — "what do I have?" — with two grids: the projection
 * at the current view-date, and the last saved balance it runs forward from. It
 * holds no inputs; editing the balance is a separate **write** transaction that
 * opens in its own shield (see resourcesEditor + [[feedback_shield_vs_unfold]]).
 * The pencil on the balance block is the only seam back to that editor.
 */

import "./resourcesSurface.css";

import { h } from "../h.ts";
import { formatBalance, formatDate } from "../format.ts";
import { cellHeading, resourceGrid, type Cell } from "./resourceLayout.ts";
import type { ResourceVector } from "../../core/projection/index.ts";
import type { Snapshot } from "../../core/persistence/document.ts";

export interface ResourcesSurfaceOpts {
  viewDate: string;
  projected: ResourceVector;
  snapshot: Snapshot | undefined;
  now: string;
  onEdit: () => void;
}

function updatedLabel(snapshotDate: string | undefined, now: string): string {
  if (!snapshotDate) return "";
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.floor(
    (new Date(`${now}T00:00:00Z`).getTime() - new Date(`${snapshotDate}T00:00:00Z`).getTime()) / msPerDay,
  );
  if (days <= 0) return "updated today";
  if (days === 1) return "updated yesterday";
  return `updated ${days} days ago`;
}

function readCell(cell: Cell, values: ResourceVector): HTMLElement {
  return h(
    "div",
    { class: "resources-surface__cell" },
    cellHeading(cell, "span"),
    h("span", { class: "resource-field__value" }, formatBalance(values[cell.key] ?? 0)),
  );
}

export function resourcesSurface(opts: ResourcesSurfaceOpts): HTMLElement {
  const snapshotResources = opts.snapshot?.resources ?? {};
  const snapshotDateLabel = opts.snapshot?.date
    ? `Balance on ${formatDate(opts.snapshot.date)}`
    : "No balance saved yet";

  return h(
    "section",
    { class: "resources-surface" },
    h(
      "div",
      { class: "resources-surface__block" },
      h("h2", { class: "resources-surface__block-title" }, `Projected on ${formatDate(opts.viewDate)}`),
      resourceGrid((cell) => readCell(cell, opts.projected)),
    ),
    h(
      "div",
      { class: "resources-surface__block" },
      h(
        "div",
        { class: "resources-surface__block-head" },
        h("h2", { class: "resources-surface__block-title" }, snapshotDateLabel),
        h(
          "button",
          {
            class: "resources-surface__edit",
            attr: { type: "button", "aria-label": "Edit balance", title: "Edit balance" },
            on: { click: opts.onEdit },
          },
          "✏️",
        ),
      ),
      resourceGrid((cell) => readCell(cell, snapshotResources)),
      h("span", { class: "resources-surface__updated" }, updatedLabel(opts.snapshot?.date, opts.now)),
    ),
  );
}
