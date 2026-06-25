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
import { img } from "../image.ts";
import { formatDateRange } from "../format.ts";
import type { BelowCard } from "../select/belowLane.ts";
import { rewardStrip } from "./widgets/rewardStrip.ts";
import { rushedToggleFor } from "./widgets/rushedToggle.ts";
import type { RushBinding } from "./widgets/rushedToggle.ts";
import { atomChip } from "./widgets/atomChip.ts";
import type { FavouriteBinding, InspectBinding } from "./widgets/atomChip.ts";

/** A below-lane welfare grant rendered as content chips — the same pill widget the
 *  banner uses (favourite + inspect-to-card-surface). Story/anniversary contents are
 *  all supports; a main-story chapter's are a support/trainee mix, so each chip reads
 *  its own `atom.kind`. Null when the card grants none. */
function atomList(card: BelowCard, fav: FavouriteBinding, inspect: InspectBinding): HTMLElement | null {
  if (card.contents.length === 0) return null;
  return h(
    "ul",
    { class: "card__atoms" },
    ...card.contents.map((atom) => atomChip(atom, atom.kind, fav, inspect)),
  );
}

function missionBody(card: BelowCard, rush: RushBinding): HTMLElement {
  return h(
    "div",
    { class: "card__mission-layout" },
    h(
      "div",
      { class: "card__mission-media" },
      img(card.image!, { class: "card__mission-image", loading: "lazy", decoding: "async" }),
    ),
    card.compact
      ? null
      : h(
          "div",
          { class: "card__mission-copy" },
          h("span", { class: "card__label", attr: { title: card.fullLabel } }, card.label),
          card.rushable ? rushedToggleFor(rush, card.key) : null,
        ),
    rewardStrip(card.reward),
  );
}

function communityLabel(card: BelowCard): string | null {
  switch (card.kind) {
    case "cm": {
      const match = /^cm-0*(\d+)$/i.exec(card.key);
      return match ? `CM${match[1]}` : null;
    }
    case "factorstudies":
      return "Tachyon";
    case "showtime":
      return "Kiseki";
    case "leagueofheroes":
      return "League";
    case "legendrace":
      return "Legends";
    case "masterschallenge":
      return "Masters";
    case "skilltest":
      return "Skill Test";
    case "strongestteam":
      return "Dream Team";
    default:
      return null;
  }
}

function mediaDateLabel(card: BelowCard): string {
  const range = formatDateRange(card.date, card.end);
  const community = communityLabel(card);
  return community ? `${community} · ${range}` : range;
}

function rectangularMedia(card: BelowCard): HTMLElement | null {
  return card.banner
    ? h(
        "div",
        { class: "card__media" },
        img(card.banner, { class: "card__image", loading: "lazy", decoding: "async" }),
        h("span", { class: "card__media-date" }, mediaDateLabel(card)),
      )
    : null;
}

function bannerCarriesLabel(card: BelowCard): boolean {
  return card.banner !== null && (
    card.kind === "cm" ||
    card.kind === "legendrace" ||
    card.kind === "showtime" ||
    card.kind === "strongestteam" ||
    card.kind === "factorstudies" ||
    card.kind === "masterschallenge" ||
    card.kind === "skilltest" ||
    card.kind === "racingcarnival" ||
    card.kind === "leagueofheroes"
  );
}

function bannerCarriesRushControl(card: BelowCard): boolean {
  return card.banner !== null && (
    card.kind === "story" ||
    card.kind === "strongestteam" ||
    card.kind === "factorstudies" ||
    card.kind === "masterschallenge" ||
    card.kind === "skilltest" ||
    card.kind === "racingcarnival" ||
    card.kind === "leagueofheroes"
  );
}

export function belowCard(card: BelowCard, rush: RushBinding, fav: FavouriteBinding, inspect: InspectBinding): HTMLElement {
  const hideLabel = bannerCarriesLabel(card);
  const hideRush = bannerCarriesRushControl(card);
  const cls = `card card--below card--${card.kind}${card.banner ? " card--bannered" : ""}${hideLabel ? " card--banner-label-art" : ""}${card.image && !card.banner ? " card--mission-art" : ""}${card.compact ? " card--compact" : ""}${card.past ? " card--past" : ""}`;
  const body = card.image && !card.banner
    ? h("div", { class: "card__body" }, missionBody(card, rush), atomList(card, fav, inspect))
    : h(
        "div",
        { class: "card__body" },
        rectangularMedia(card),
        hideLabel ? null : h("span", { class: "card__label", attr: { title: card.fullLabel } }, card.label),
        card.rushable && !hideRush ? rushedToggleFor(rush, card.key) : null,
        atomList(card, fav, inspect),
        rewardStrip(card.reward),
      );
  const el = h(
    "div",
    { class: cls, attr: card.compact ? { title: card.fullLabel } : {} },
    h("div", { class: "card__stem" }),
    body,
  );
  el.style.left = `${card.x}px`;
  return el;
}
