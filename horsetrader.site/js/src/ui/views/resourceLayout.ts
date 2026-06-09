/**
 * The shared resource-grid layout: the row/column definitions and the cell
 * chrome (heading + icon) that BOTH the read surface and the write editor draw.
 * The two diverge only in the cell *body* (a static value vs. an input), so the
 * grid shell takes a `renderCell` and lets each caller supply that body. The row
 * definitions are the one load-bearing constant — they fix the resource order
 * and grouping the whole feature reads against.
 */

import "./resourceLayout.css";

import { h } from "../h.ts";

export type Cell = { key: string; heading: string; icon: string };

export const RESOURCE_ROWS: readonly (readonly Cell[])[] = [
  [
    { key: "free_carats",            heading: "Free",    icon: "/icons/carat.png"           },
    { key: "paid_carats",            heading: "Paid",    icon: "/icons/carat.png"           },
    { key: "trainee_tickets",        heading: "Trainee", icon: "/icons/trainee_ticket.png"  },
    { key: "support_tickets",        heading: "Support", icon: "/icons/support_ticket.png"  },
  ],
  [
    { key: "rainbow_crystal",        heading: "Uncap",   icon: "/icons/rainbow_crystal.png" },
    { key: "rainbow_crystal_shards", heading: "Shards",  icon: "/icons/rainbow_shard.png"   },
    { key: "gold_crystal",           heading: "Uncap",   icon: "/icons/gold_crystal.png"    },
    { key: "gold_crystal_shards",    heading: "Shards",  icon: "/icons/gold_shard.png"      },
  ],
];

export function cellHeading(cell: Cell, tag: "span", attrs?: Record<string, string>): HTMLElement;
export function cellHeading(cell: Cell, tag: "label", attrs: { for: string }): HTMLElement;
export function cellHeading(cell: Cell, tag: "span" | "label", attrs: Record<string, string> = {}): HTMLElement {
  return h(
    tag,
    { class: "resource-field__heading", attr: attrs },
    h("img", { class: "resource-field__icon", attr: { src: cell.icon, alt: "", width: 14, height: 14 } }),
    cell.heading,
  );
}

export function resourceGrid(renderCell: (cell: Cell) => HTMLElement): HTMLElement {
  return h(
    "div",
    { class: "resource-grid" },
    ...RESOURCE_ROWS.map((row) => h("div", { class: "resource-grid__row" }, ...row.map(renderCell))),
  );
}
