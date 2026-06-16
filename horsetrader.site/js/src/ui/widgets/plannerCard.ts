import "./plannerCard.css";

import { h } from "../h.ts";
import { formatDate } from "../format.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";
import type { PlannerRow } from "../select/planner.ts";
import { PITY_WASTE_ABOVE } from "../select/aboveLane.ts";
import { commitmentBadge } from "./commitmentBadge.ts";

export interface PlannerCardOpts {
  row: PlannerRow;
  onWarp(date: CalendarDate): void;
  onCommit(bannerKey: string): void;
}

export function plannerCard({ row, onWarp, onCommit }: PlannerCardOpts): HTMLElement {
  const warp = (): void => onWarp(row.date);

  // No pills here: the banner art carries the identity, and the card warps to the
  // banner itself for the full line-up. Just the art, the commitment, and the date.
  return h(
    "div",
    {
      class: `planner-card planner-card--${row.kind}`,
      attr: { role: "button", tabindex: "0" },
      on: {
        click: warp,
        keydown: (ev) => {
          if (ev.key !== "Enter" && ev.key !== " ") return;
          ev.preventDefault();
          warp();
        },
      },
    },
    h("img", { class: "planner-card__image", attr: { src: row.image, alt: "", loading: "lazy", decoding: "async" } }),
    h(
      "span",
      { class: "planner-card__meta" },
      h("span", { class: "planner-card__pity" }, commitmentBadge({ pity: row.pity, unfundable: row.unfundable, wasteAbove: PITY_WASTE_ABOVE[row.kind], onOpen: () => onCommit(row.key) })),
      h("span", { class: "planner-card__date" }, formatDate(row.date)),
    ),
  );
}
