import "./commitmentBadge.css";

import { h } from "../../h.ts";
import { formatBalance } from "../../format.ts";
import { pityBand } from "./pityBand.ts";

export interface CommitmentBadgeOpts {
  pity: number;
  unfundable?: boolean;
  /** Pity above which the commitment reads as overspend (purple); kind-dependent,
   *  so the caller supplies it (see PITY_WASTE_ABOVE). Defaults to the support tier. */
  wasteAbove?: number;
  onOpen(): void;
}

/** Shared pity commitment affordance. It is both status (the committed pity) and
 * the edit entry point for the commit dossier. */
export function commitmentBadge({ pity, unfundable = false, wasteAbove = 3, onOpen }: CommitmentBadgeOpts): HTMLElement {
  return h(
    "button",
    {
      class: `commitment-badge pity-band--${pityBand(pity, unfundable, wasteAbove)}`,
      attr: { type: "button", "aria-label": pity > 0 ? `Edit ${formatBalance(pity)} pity commitment` : "Plan a pull" },
      on: {
        pointerdown: (ev) => ev.stopPropagation(),
        dblclick: (ev) => ev.stopPropagation(),
        click: (ev) => {
          ev.stopPropagation();
          onOpen();
        },
      },
    },
    formatBalance(pity),
  );
}
