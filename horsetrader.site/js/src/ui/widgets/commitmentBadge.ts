import "./commitmentBadge.css";

import { h } from "../h.ts";
import { formatBalance } from "../format.ts";

export interface CommitmentBadgeOpts {
  pity: number;
  unfundable?: boolean;
  onOpen(): void;
}

/** Shared pity commitment affordance. It is both status (the committed pity) and
 * the edit entry point for the commit shield. */
export function commitmentBadge({ pity, unfundable = false, onOpen }: CommitmentBadgeOpts): HTMLElement {
  return h(
    "button",
    {
      class: `commitment-badge${unfundable ? " commitment-badge--unfundable" : ""}${pity === 0 ? " commitment-badge--empty" : ""}`,
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
