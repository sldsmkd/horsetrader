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

import "./card.css";
import "./belowCard.css";

import { h } from "../h.ts";
import type { BelowCard } from "../select/belowLane.ts";
import { rewardStrip } from "../widgets/rewardStrip.ts";
import { rushedToggleFor } from "../widgets/rushedToggle.ts";
import type { RushBinding } from "../widgets/rushedToggle.ts";

function missionBody(card: BelowCard, rush: RushBinding): HTMLElement {
  return h(
    "div",
    { class: "card__mission-layout" },
    h(
      "div",
      { class: "card__mission-media" },
      h("img", { class: "card__mission-image", attr: { src: card.image!, alt: "", loading: "lazy", decoding: "async" } }),
    ),
    h(
      "div",
      { class: "card__mission-copy" },
      h("span", { class: "card__label", attr: { title: card.fullLabel } }, card.label),
      card.rushable ? rushedToggleFor(rush, card.key) : null,
    ),
    rewardStrip(card.reward),
  );
}

function rectangularMedia(card: BelowCard): HTMLElement | null {
  return card.banner
    ? h(
        "div",
        { class: "card__media" },
        h("img", { class: "card__image", attr: { src: card.banner, alt: "", loading: "lazy", decoding: "async" } }),
      )
    : null;
}

export function belowCard(card: BelowCard, rush: RushBinding): HTMLElement {
  const cls = `card card--below card--${card.kind}${card.banner ? " card--bannered" : ""}${card.image ? " card--mission-art" : ""}${card.past ? " card--past" : ""}`;
  const body = card.image
    ? h("div", { class: "card__body" }, missionBody(card, rush))
    : h(
        "div",
        { class: "card__body" },
        rectangularMedia(card),
        h("span", { class: "card__label", attr: { title: card.fullLabel } }, card.label),
        card.rushable ? rushedToggleFor(rush, card.key) : null,
        rewardStrip(card.reward),
      );
  const el = h(
    "div",
    { class: cls },
    h("div", { class: "card__stem" }),
    body,
  );
  el.style.left = `${card.x}px`;
  return el;
}
