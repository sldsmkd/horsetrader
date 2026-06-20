import "./collapsePill.css";

import { h } from "../../h.ts";

/**
 * The shared flow-marker collapse pill. A surface's dismiss affordance: chevrons
 * that point the way the surface goes when you collapse it. `up` is a vertical
 * pill (panels that tuck upward — trainer card, resources); `left` is horizontal
 * (the play-style card, which folds back into the trainer card beside it). Pass
 * `float` to pin it at the top-right of a `position: relative` surface; omit it to
 * drop the pill into normal flow (e.g. a flex mast).
 */
export interface CollapsePillOpts {
  direction: "up" | "left";
  label: string;
  onClick: () => void;
  float?: boolean;
}

export function collapsePill(opts: CollapsePillOpts): HTMLButtonElement {
  const classes = ["collapse-pill", `collapse-pill--${opts.direction}`];
  if (opts.float) classes.push("collapse-pill--float");
  return h(
    "button",
    {
      class: classes.join(" "),
      attr: { type: "button", "aria-label": opts.label },
      on: { click: opts.onClick },
    },
    h("span", { class: "collapse-pill__chevrons", attr: { "aria-hidden": "true" } }, "««"),
  );
}
