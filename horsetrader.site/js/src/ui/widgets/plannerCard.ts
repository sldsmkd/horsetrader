import "./plannerCard.css";

import { h } from "../h.ts";
import { formatDate } from "../format.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";
import type { PlannerRow } from "../select/planner.ts";
import { atomChip } from "./atomChip.ts";
import type { FavouriteBinding } from "./atomChip.ts";
import { commitmentBadge } from "./commitmentBadge.ts";

export interface PlannerCardOpts {
  row: PlannerRow;
  fav: FavouriteBinding;
  onWarp(date: CalendarDate): void;
  onCommit(bannerKey: string): void;
}

export function plannerCard({ row, fav, onWarp, onCommit }: PlannerCardOpts): HTMLElement {
  const warp = (): void => onWarp(row.date);

  // In the planner the pills are a reminder of *what you committed for*, so we show
  // only the starred ones. None starred → no pills: the card still warps to the
  // banner, where the full line-up answers "why am I pulling?" on demand.
  const shownAtoms = row.atoms.filter((atom) => fav.isFavourited(atom.id));

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
      "ul",
      { class: "planner-card__atoms" },
      ...shownAtoms.map((atom) => atomChip(atom, fav)),
    ),
    h(
      "span",
      { class: "planner-card__meta" },
      h("span", { class: "planner-card__pity" }, commitmentBadge({ pity: row.pity, unfundable: row.unfundable, onOpen: () => onCommit(row.key) })),
      h("span", { class: "planner-card__date" }, formatDate(row.date)),
    ),
  );
}
