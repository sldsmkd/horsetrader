/**
 * The below-lane card view — `(props) → HTMLElement`, dumb on purpose (no data
 * access, no state, no cross-view reach; ui.md the layer cake). A single income
 * atom: its own reward is its signal (ui.md EC1 — height carries the breakdown),
 * a per-kind left-border accent reads "what kind" pre-verbally (principle 5), and
 * the stem pins it to its true date (principle 4).
 *
 * It positions itself at its true-date `x` (`left`); 4e's packer will add a
 * y-offset transform to resolve overlaps without ever moving the stem off-tick.
 */

import { h } from "../h.ts";
import { formatDelta } from "../format.ts";
import type { BelowCard } from "../select/belowLane.ts";

export function belowCard(card: BelowCard): HTMLElement {
  const cls = `card card--below card--${card.kind}${card.predicted ? " card--predicted" : ""}`;
  const el = h(
    "div",
    { class: cls },
    h("div", { class: "card__stem" }),
    h(
      "div",
      { class: "card__body" },
      h("span", { class: "card__label" }, card.label),
      h("span", { class: "card__reward" }, formatDelta(card.reward.carats_free ?? 0)),
    ),
  );
  el.style.left = `${card.x}px`;
  return el;
}
