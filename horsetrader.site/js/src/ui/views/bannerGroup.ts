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
import { formatDateRange, formatBalance } from "../format.ts";
import { PITY_WASTE_ABOVE } from "../select/aboveLane.ts";
import type { Banner, BannerGroup, BannerKind } from "../select/aboveLane.ts";
import { atomChip } from "./widgets/atomChip.ts";
import type { FavouriteBinding } from "./widgets/atomChip.ts";
import { commitmentBadge } from "./widgets/commitmentBadge.ts";

/** The commit seam handed to the banner readout: spawn the commit dossier for a
 *  banner (the write transaction lives there, not on the card). Keyed by banner
 *  key; `open` is a no-op when a modal is already up (app.ts guards it). */
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
      h("span", { class: "banner-group__date" }, formatDateRange(group.date, group.end)),
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
  const atoms = atomList(banner, fav);
  const heatBand = banner.open ? bannerHeatBand(banner.freePulls) : 0;
  const el = h(
    "div",
    { class: `banner banner--${banner.kind}${heatBand > 0 ? ` banner--hot banner--hot-${heatBand}` : ""}${banner.past && !groupPast ? " banner--past" : ""}` },
    h(
      "div",
      { class: "banner__image-frame" },
      h("img", { class: "banner__image", attr: { src: banner.image, alt: "", loading: "lazy" } }),
    ),
    atoms,
    banner.open ? pullChin(banner) : null,
    // The commit badge floats over the card's bottom-right corner (a circle), so
    // it's a direct child of `.banner` (the positioned ancestor), not the chin.
    banner.open ? commitBadge(banner, commit) : null,
  );
  return el;
}

function commitBadge(banner: Banner, commit: CommitBinding): HTMLElement {
  return h(
    "span",
    { class: "banner__commit-badge" },
    commitmentBadge({ pity: banner.committedPity ?? 0, unfundable: banner.commitmentUnfundable, wasteAbove: PITY_WASTE_ABOVE[banner.kind], onOpen: () => commit.open(banner.key) }),
  );
}

function bannerHeatBand(freePulls: number): 0 | 1 | 2 | 3 | 4 {
  if (freePulls <= 0) return 0;
  if (freePulls < 10) return 1;
  if (freePulls < 40) return 2;
  if (freePulls < 80) return 3;
  return 4;
}

function atomList(banner: Banner, fav: FavouriteBinding): HTMLUListElement {
  const el = h(
    "ul",
    {
      class: "banner__atoms",
      on: {
        pointerdown: (ev) => {
          if (el.classList.contains("banner__atoms--scrollable")) ev.stopPropagation();
        },
        wheel: (ev) => {
          if (el.classList.contains("banner__atoms--scrollable")) ev.stopPropagation();
        },
      },
    },
    ...banner.atoms.map((atom) => atomChip(atom, fav)),
  );
  // The timeline card layer is pointer-transparent so panning works over cards.
  // Only genuinely overflowing chip lists opt back into pointer handling; otherwise
  // ordinary banners would steal drag starts from the timeline for no benefit.
  requestAnimationFrame(() => {
    el.classList.toggle("banner__atoms--scrollable", el.scrollHeight > el.clientHeight + 1);
  });
  return el;
}

function pullChin(banner: Banner): HTMLElement {
  return h(
    "footer",
    { class: "banner__pull-chin", attr: { "aria-label": "Available pulls" } },
    h("div", { class: "banner__pull-total" }, pullStat("total", "🎲", "total pulls", banner.pullsAvailable)),
    h(
      "div",
      { class: "banner__pull-breakdown", attr: { "aria-label": "Gift pulls, ticket pulls, paid carat pulls" } },
      pullStat("free", "🎁", "gift pulls", banner.freePulls),
      separator(),
      pullStat("tickets", `/icons/${banner.kind}_ticket.png`, `${banner.kind} ticket pulls`, banner.ticketPulls),
      separator(),
      pullStat("paid-carats", "/icons/carat.png", "paid carat pulls", banner.paidCaratPulls),
    ),
  );
}

function separator(): HTMLElement {
  return h("span", { class: "banner__pull-separator", attr: { "aria-hidden": "true" } }, "|");
}

function pullStat(kind: string, icon: string, label: string, value: number): HTMLElement {
  return stat(kind, icon, formatBalance(value), label);
}

function stat(kind: string, icon: string, value: string, label?: string): HTMLElement {
  const iconEl = icon.startsWith("/")
    ? h("img", { class: "banner__stat-img", attr: { src: icon, alt: "", width: 16, height: 16, loading: "lazy", decoding: "async" } })
    : h("span", { class: "banner__stat-icon" }, icon);
  return h(
    "div",
    { class: `banner__stat banner__stat--${kind}`, ...(label ? { attr: { title: label, "aria-label": `${label}: ${value}` } } : {}) },
    iconEl,
    h("span", { class: "banner__stat-value" }, value),
  );
}
