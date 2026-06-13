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
import type { Banner, BannerGroup, BannerKind } from "../select/aboveLane.ts";
import { atomChip } from "../widgets/atomChip.ts";
import type { FavouriteBinding } from "../widgets/atomChip.ts";

/** The commit seam handed to the banner readout: spawn the commit shield for a
 *  banner (the write transaction lives there, not on the card). Keyed by banner
 *  key; `open` is a no-op when a shield is already up (app.ts guards it). */
export interface CommitBinding {
  open: (bannerKey: string) => void;
}

export function bannerGroup(group: BannerGroup, fav: FavouriteBinding, commit: CommitBinding): HTMLElement {
  const el = h(
    "div",
    { class: `card card--above${group.past ? " card--past" : ""}` },
    h(
      "div",
      { class: "banner-group" },
      h(
        "div",
        { class: "banner-group__lanes" },
        lane("trainee", group.banners, fav, commit, group.past),
        lane("support", group.banners, fav, commit, group.past),
      ),
      h("span", { class: "banner-group__date" }, formatDate(group.date)),
    ),
    h("div", { class: "card__stem" }),
  );
  el.style.left = `${group.x}px`;
  return el;
}

/** Internal group lanes keep a stable scanline: trainees above, supports below.
 *  Each lane flows horizontally, so busy launch beats grow sideways instead of
 *  into a tall stack that disappears off the top of the viewport. */
function lane(kind: BannerKind, banners: readonly Banner[], fav: FavouriteBinding, commit: CommitBinding, groupPast = false): HTMLElement | null {
  const matches = banners.filter((banner) => banner.kind === kind);
  if (matches.length === 0) return null;
  return h("div", { class: `banner-group__lane banner-group__lane--${kind}` }, ...matches.map((banner) => bannerCard(banner, fav, commit, groupPast)));
}

function bannerCard(banner: Banner, fav: FavouriteBinding, commit: CommitBinding, groupPast: boolean): HTMLElement {
  return h(
    "div",
    { class: `banner banner--${banner.kind}${banner.past && !groupPast ? " banner--past" : ""}` },
    h("img", { class: "banner__image", attr: { src: banner.image, alt: "", loading: "lazy" } }),
    h("ul", { class: "banner__atoms" }, ...banner.atoms.map((atom) => atomChip(atom, fav))),
    banner.open ? readout(banner, commit) : null,
  );
}

/**
 * The per-banner readout — three icon+number lines (ui.md "what to present"):
 *   1. pulls I have, any source collapsed (the ammo count);
 *   2. free pulls the game grants — a number for now, the value signal later;
 *   3. what I committed, in pities — conditional: no commitment, no line.
 * Wireframe fidelity: plain glyph + value, structure only (skin/layout deferred).
 * Editing the commitment is *not* done here — the commit control spawns a shield
 * (the surface/shield split); the pity line is the read-back of what it wrote.
 */
function readout(banner: Banner, commit: CommitBinding): HTMLElement {
  return h(
    "div",
    { class: "banner__readout" },
    stat("pulls", "🎲", formatBalance(banner.pullsAvailable)),
    stat("free", "🎁", formatBalance(banner.freePulls)),
    commitButton(banner, commit),
  );
}

/** The seam back to the commit shield (ui.md: commitment is entered *at source*,
 *  on the banner). Reads as the pity line when committed, a quiet prompt otherwise.
 *  An in-timeline control, so it stops `pointerdown` from the pan capture (the same
 *  guard the favourite star carries). */
function commitButton(banner: Banner, commit: CommitBinding): HTMLElement {
  const committed = banner.committedPity !== null;
  return h(
    "button",
    {
      class: `banner__stat banner__stat--pity banner__commit${committed ? " banner__commit--set" : ""}`,
      attr: { type: "button", "aria-label": committed ? "Edit commitment" : "Plan a pull" },
      on: {
        pointerdown: (ev) => ev.stopPropagation(),
        click: () => commit.open(banner.key),
      },
    },
    h("span", { class: "banner__stat-icon" }, "🎯"),
    h("span", { class: "banner__stat-value" }, committed ? `${formatBalance(banner.committedPity!)} pity` : "Commit"),
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
