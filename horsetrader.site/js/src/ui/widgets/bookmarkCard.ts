import "./bookmarkCard.css";

import { h } from "../h.ts";
import { formatDate } from "../format.ts";
import type { BookmarkRow } from "../select/bookmarks.ts";
import { nextBookmarkDate } from "../select/bookmarks.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";

export interface BookmarkCardOpts {
  row: BookmarkRow;
  onWarp(row: BookmarkRow): void;
}

export interface BookmarkCard {
  el: HTMLElement;
  setView(date: CalendarDate): void;
}

/** A favourited atom as a navigation card: image, identity text, next date, and
 * remaining appearance count. The drawer owns the list chrome; this owns the
 * reusable bookmark item body. */
export function bookmarkCard({ row, onWarp }: BookmarkCardOpts): BookmarkCard {
  const next = row.appearances[0]!;
  const count = row.appearances.length;
  const countLabel = count === 1 ? "1 appearance" : `${count} appearances`;
  const image = row.image
    ? h("img", {
        class: `bookmark-card__image bookmark-card__image--${row.rarityTier}`,
        attr: { src: row.image, alt: "", width: 44, height: 44, loading: "lazy", decoding: "async" },
      })
    : h("span", { class: `bookmark-card__image bookmark-card__image--placeholder bookmark-card__image--${row.rarityTier}`, attr: { "aria-hidden": "true" } }, row.name.slice(0, 1));
  const dateEl = h("span", { class: "bookmark-card__date" }, formatDate(next.date));

  const el = h(
    "button",
    {
      class: `bookmark-card bookmark-card--${row.kind} bookmark-card--${row.rarityTier}`,
      attr: { type: "button" },
      on: { click: () => onWarp(row) },
    },
    image,
    h(
      "span",
      { class: "bookmark-card__copy" },
      h("span", { class: "bookmark-card__name" }, row.name),
      h("span", { class: "bookmark-card__subtext" }, row.subtext),
    ),
    h(
      "span",
      { class: "bookmark-card__meta" },
      dateEl,
      h("span", { class: "bookmark-card__count" }, countLabel),
    ),
  );

  return {
    el,
    setView(date) {
      const target = nextBookmarkDate(row, date);
      if (target) dateEl.textContent = formatDate(target);
    },
  };
}
