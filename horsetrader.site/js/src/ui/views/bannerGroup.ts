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

import "./card.css";
import "./bannerGroup.css";

import { h } from "../h.ts";
import { formatDate, formatBalance } from "../format.ts";
import type { Banner, BannerGroup } from "../select/aboveLane.ts";
import { rushedToggleFor } from "../widgets/rushedToggle.ts";
import type { RushBinding } from "../widgets/rushedToggle.ts";
import { atomChip } from "../widgets/atomChip.ts";
import type { FavouriteBinding } from "../widgets/atomChip.ts";

export function bannerGroup(group: BannerGroup, rush: RushBinding, fav: FavouriteBinding): HTMLElement {
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
          h("ul", { class: "banner__atoms" }, ...banner.atoms.map((atom) => atomChip(atom, fav))),
          banner.rushable ? rushedToggleFor(rush, banner.key) : null,
          readout(banner),
        ),
      ),
      h("span", { class: "banner-group__date" }, formatDate(group.date)),
    ),
    h("div", { class: "card__stem" }),
  );
  el.style.left = `${group.x}px`;
  return el;
}

/**
 * The per-banner readout — three icon+number lines (ui.md "what to present"):
 *   1. pulls I have, any source collapsed (the ammo count);
 *   2. free pulls the game grants — a number for now, the value signal later;
 *   3. what I committed, in pities — conditional: no commitment, no line.
 * Wireframe fidelity: plain glyph + value, structure only (skin/layout deferred).
 * Editing the commitment is *not* done here — it spawns a shield (the surface/shield
 * split); this readout is the read-back of what that shield wrote.
 */
function readout(banner: Banner): HTMLElement {
  return h(
    "div",
    { class: "banner__readout" },
    stat("pulls", "🎲", formatBalance(banner.pullsAvailable)),
    stat("free", "🎁", formatBalance(banner.freePulls)),
    banner.committedPity !== null ? stat("pity", "🎯", `${formatBalance(banner.committedPity)} pity`) : null,
  );
}

function stat(kind: string, icon: string, value: string): HTMLElement {
  return h(
    "div",
    { class: `banner__stat banner__stat--${kind}` },
    h("span", { class: "banner__stat-icon" }, icon),
    h("span", { class: "banner__stat-value" }, value),
  );
}
