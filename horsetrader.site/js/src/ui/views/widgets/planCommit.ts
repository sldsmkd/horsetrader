import "./planCommit.css";

import { h } from "../../h.ts";
import { formatBalance } from "../../format.ts";
import { pityBand } from "./pityBand.ts";

export interface PlanCommitOpts {
  pity: number;
  /** The banner's start, month + day only (no year) — folded under the pity number. */
  date: string;
  unfundable?: boolean;
  /** Pity above which the commitment reads as overspend; kind-dependent (PITY_WASTE_ABOVE). */
  wasteAbove?: number;
  onOpen(): void;
}

/** The Desk's commitment box — the banner badge's colour grammar (the shared pity-band
 *  fill) but taller, folding the banner's start date (month + day) under the big pity
 *  number. Like commitmentBadge it is both status and the dossier edit entry point. */
export function planCommit({ pity, date, unfundable = false, wasteAbove = 3, onOpen }: PlanCommitOpts): HTMLElement {
  return h(
    "button",
    {
      class: `plan-commit pity-band--${pityBand(pity, unfundable, wasteAbove)}`,
      attr: { type: "button", "aria-label": `Edit ${formatBalance(pity)} pity commitment` },
      on: {
        pointerdown: (ev) => ev.stopPropagation(),
        dblclick: (ev) => ev.stopPropagation(),
        click: (ev) => {
          ev.stopPropagation();
          onOpen();
        },
      },
    },
    h("span", { class: "plan-commit__pity" }, formatBalance(pity)),
    h("span", { class: "plan-commit__date" }, date),
  );
}
