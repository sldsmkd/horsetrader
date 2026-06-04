/**
 * The above-lane banner-group view — `(group) → HTMLElement`, dumb like its
 * below-lane sibling. Banners sharing a start date are one *container* (ui.md
 * EC3): the group body holds each banner's art + content pills (the borrowed
 * rarity grammar, principle 5) and carries the shared date; the stem hangs down
 * to the true-date tick (principle 4).
 *
 * The container sits at its appearance-date `x` (`left`). The packer nudges the
 * inner `.banner-group` body horizontally to clear neighbours — the stem stays on
 * the tick, the body drifts (so the group is built body-then-stem, body nudgeable).
 */

import { h } from "../h.ts";
import { formatDate } from "../format.ts";
import type { BannerGroup } from "../select/aboveLane.ts";

export function bannerGroup(group: BannerGroup): HTMLElement {
  const el = h(
    "div",
    { class: `card card--above${group.predicted ? " card--predicted" : ""}` },
    h(
      "div",
      { class: "banner-group" },
      ...group.banners.map((banner) =>
        h(
          "div",
          { class: `banner banner--${banner.kind}` },
          h("img", { class: "banner__image", attr: { src: banner.image, alt: "", loading: "lazy" } }),
          h(
            "ul",
            { class: "banner__atoms" },
            ...banner.atoms.map((atom) =>
              h(
                "li",
                { class: "atom" },
                h("span", { class: "atom__name" }, atom.name),
                h("span", { class: "atom__rarity" }, atom.rarity),
              ),
            ),
          ),
        ),
      ),
      h("span", { class: "banner-group__date" }, formatDate(group.date)),
    ),
    h("div", { class: "card__stem" }),
  );
  el.style.left = `${group.x}px`;
  return el;
}
