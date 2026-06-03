/**
 * The above-lane banner card view — `(props) → HTMLElement`, dumb like its
 * below-lane sibling. A banner is a *container of atoms* (ui.md EC3): the banner
 * art + date identity pins it (principle 4), and the resolved content atoms read
 * as pills in the game's own rarity grammar (principle 5). The stem hangs down to
 * the true-date tick.
 *
 * Positions itself at its appearance-date `x` (`left`); 4e's packer handles the
 * above-lane strategy (group-by-shared-start + nudge) without moving the stem.
 */

import { h } from "../h.ts";
import type { BannerCard } from "../select/aboveLane.ts";

export function bannerCard(card: BannerCard): HTMLElement {
  const cls = `card card--above card--${card.kind}${card.predicted ? " card--predicted" : ""}`;
  const el = h(
    "div",
    { class: cls },
    h(
      "div",
      { class: "card__body" },
      h("img", { class: "card__image", attr: { src: card.image, alt: "", loading: "lazy" } }),
      h(
        "ul",
        { class: "card__atoms" },
        ...card.atoms.map((atom) =>
          h(
            "li",
            { class: "atom" },
            h("span", { class: "atom__name" }, atom.name),
            h("span", { class: "atom__rarity" }, atom.rarity),
          ),
        ),
      ),
    ),
    h("div", { class: "card__stem" }),
  );
  el.style.left = `${card.x}px`;
  return el;
}
