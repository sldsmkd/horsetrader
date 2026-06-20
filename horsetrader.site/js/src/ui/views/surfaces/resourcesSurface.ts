/**
 * The Resources surface: a pure **read** of your account. It answers the one
 * question the player asked — "what do I have?" — as a single projected readout:
 * the carat headline (free/paid), the scout tickets, and the two limit-breaker
 * meters (whole crystals + shards toward the next, 20 shards crafting one). It
 * holds no inputs; editing the saved balance is a separate **write** transaction
 * that opens in its own modal (see resourcesEditor + [[feedback_shield_vs_unfold]]).
 * The "Update Actual Balance" button is the only seam back to that editor.
 *
 * It returns a small handle, not a bare element: panning the timeline moves the
 * view date 60 Hz off the surface-render path (app.ts `onView`), so the open card
 * follows the projection through `update()` — the same imperative-readout pattern
 * the menubar uses (`setResources`), not a full surface rebuild per frame. The
 * footer (which reads the saved snapshot, not the view date) is captured once.
 */

import "./resourcesSurface.css";

import { h } from "../../h.ts";
import { collapsePill } from "../collapsePill.ts";
import { formatBalance, formatDate } from "../../format.ts";
import { limitBreaker } from "../limitBreaker.ts";
import type { ResourceVector } from "../../../core/projection/index.ts";
import type { Snapshot } from "../../../core/persistence/document.ts";

export interface ResourcesSurfaceOpts {
  viewDate: string;
  projected: ResourceVector;
  snapshot: Snapshot | undefined;
  now: string;
  onEdit: () => void;
  /** Collapse the surface — wired to the up-chevron pill, replacing the window x. */
  onClose: () => void;
}

/** The live readout the surface follows as the view date pans. */
export interface ResourcesProjection {
  viewDate: string;
  projected: ResourceVector;
}

export interface ResourcesSurfaceHandle {
  el: HTMLElement;
  update(projection: ResourcesProjection): void;
}

function val(values: ResourceVector, key: string): number {
  const v = values[key] ?? 0;
  // Non-free-carat resources report a floor of 0: the readout shows spendable stock,
  // not a committed shortfall. Only free carats — the overflow release valve — may
  // read negative (project_spend_model). Mirrors the banner chin's per-source floor.
  return key === "free_carats" ? v : Math.max(0, v);
}

function updatedLabel(snapshotDate: string | undefined, now: string): string {
  if (!snapshotDate) return "No balance recorded yet";
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.floor(
    (new Date(`${now}T00:00:00Z`).getTime() - new Date(`${snapshotDate}T00:00:00Z`).getTime()) / msPerDay,
  );
  if (days <= 0) return "Last updated today";
  if (days === 1) return "Last updated yesterday";
  return `Last updated ${days} days ago`;
}

function ticket(icon: string, name: string, count: number): HTMLElement {
  return h(
    "div",
    { class: "resources-surface__ticket" },
    h("img", { class: "resources-surface__ticket-icon", attr: { src: icon, alt: name, title: name, width: 24, height: 24 } }),
    h("span", { class: "resources-surface__ticket-count" }, formatBalance(count)),
  );
}

/** The footer is view-date-independent — it reports on the saved snapshot — so it
 *  is built once and reused across pans. */
function footer(opts: ResourcesSurfaceOpts): HTMLElement {
  const stale = !!opts.snapshot?.date && opts.now > opts.snapshot.date;
  return h(
    "footer",
    { class: "resources-surface__footer" },
    h(
      "div",
      { class: "resources-surface__footer-note" },
      h("span", { class: "resources-surface__clock", attr: { "aria-hidden": "true" } }, "🕐"),
      h(
        "p",
        { class: "resources-surface__footer-text" },
        "This projection is based on your last recorded balance. ",
        h(
          "span",
          { class: `resources-surface__updated${stale ? " resources-surface__updated--stale" : ""}` },
          updatedLabel(opts.snapshot?.date, opts.now),
        ),
      ),
    ),
    h(
      "button",
      {
        class: "resources-surface__edit",
        attr: { type: "button" },
        on: { click: opts.onEdit },
      },
      "Record Balance",
    ),
  );
}

/** The projection-derived readout: everything that moves as the view date pans. */
function readout(viewDate: string, p: ResourceVector): HTMLElement {
  const free = val(p, "free_carats");
  const paid = val(p, "paid_carats");
  return h(
    "div",
    { class: "resources-surface__readout" },
    // Headline: the projected carat total, broken into free / paid.
    h(
      "div",
      { class: "resources-surface__predicted" },
      h(
        "div",
        { class: "resources-surface__carats" },
        h("img", { class: "resources-surface__carat-icon", attr: { src: "/icons/carat.png", alt: "", width: 56, height: 56 } }),
        h("span", { class: "resources-surface__carat-total" }, formatBalance(free + paid)),
      ),
      h(
        "div",
        { class: "resources-surface__carat-split" },
        `(${formatBalance(free)} Free • ${formatBalance(paid)} Paid)`,
      ),
      h("div", { class: "resources-surface__projected-on" }, `Projected on ${formatDate(viewDate)}`),
    ),

    h("hr", { class: "resources-surface__divider" }),

    h(
      "div",
      { class: "resources-surface__tickets" },
      ticket("/icons/support_ticket.png", "Support Scout Tickets", val(p, "support_tickets")),
      ticket("/icons/trainee_ticket.png", "Trainee Scout Tickets", val(p, "trainee_tickets")),
    ),

    h("hr", { class: "resources-surface__divider" }),

    h(
      "div",
      { class: "resources-surface__breakers" },
      h("span", { class: "resources-surface__label" }, "Limit Breakers"),
      limitBreaker({
        variant: "rainbow",
        name: "Rainbow",
        icon: "/icons/rainbow_crystal.png",
        crystals: val(p, "rainbow_crystal"),
        shards: val(p, "rainbow_crystal_shards"),
      }),
      limitBreaker({
        variant: "gold",
        name: "Gold",
        icon: "/icons/gold_crystal.png",
        crystals: val(p, "gold_crystal"),
        shards: val(p, "gold_crystal_shards"),
      }),
    ),

    h("hr", { class: "resources-surface__divider" }),
  );
}

export function resourcesSurface(opts: ResourcesSurfaceOpts): ResourcesSurfaceHandle {
  let live = readout(opts.viewDate, opts.projected);
  // Floating up-chevron pill: this panel collapses upward toward the carats chip
  // in the menu. Static, so it sits outside the live readout the pan path replaces.
  const collapse = collapsePill({
    direction: "up",
    float: true,
    label: "Collapse resources",
    onClick: opts.onClose,
  });
  const el = h("section", { class: "resources-surface" }, collapse, live, footer(opts));

  return {
    el,
    update({ viewDate, projected }) {
      const next = readout(viewDate, projected);
      live.replaceWith(next);
      live = next;
    },
  };
}
