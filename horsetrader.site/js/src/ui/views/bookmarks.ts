/**
 * The bookmarks drawer — favourites as navigation (ui.md "Bookmarks"). A
 * collapsible docked panel summoned by a chevron tab; each row warps the timeline
 * to a future appearance of a favourited atom. It is **layer-2 chrome** alongside
 * the menubar and minimap: non-blocking (it shields nothing and is shielded by
 * nothing), painted *under* the overlays it shares the top-left zone with, and the
 * canvas stays live behind it.
 *
 * It is the **list-twin of the minimap's favourite dots** — the same favourites
 * map rendered as a scrollable list (`select/bookmarks.ts` owns the derivation).
 * Pure view: it renders rows, forwards the toggle + warp intents, and reads
 * nothing back out of the DOM. **Empty is a quiet inactive state** (a greyed,
 * disabled tab), not an error — with nothing to navigate to, the surface recedes.
 */

import "./bookmarks.css";

import { h } from "../h.ts";
import { formatDate } from "../format.ts";
import type { BookmarkRow } from "../select/bookmarks.ts";

export interface BookmarksHandlers {
  /** Toggle the drawer open/collapsed (the chevron tab). */
  onToggle(): void;
  /** Warp the timeline view to a row's appearance date. */
  onWarp(date: string): void;
}

/** What `refresh` needs: the derived rows and whether the drawer is open. */
export interface BookmarksRefresh {
  rows: readonly BookmarkRow[];
  open: boolean;
}

export interface Bookmarks {
  /** The always-mounted drawer (collapses to its tab). */
  readonly el: HTMLElement;
  /** Re-render rows + open state — the render path (favourites/view-state changed). */
  refresh(p: BookmarksRefresh): void;
}

export function bookmarks({ onToggle, onWarp }: BookmarksHandlers): Bookmarks {
  const list = h("ul", { class: "bookmarks__list" });
  const tab = h(
    "button",
    {
      class: "bookmarks__tab",
      attr: { type: "button", "aria-label": "Bookmarks", "aria-expanded": "false" },
      on: { click: onToggle },
    },
    h("span", { class: "bookmarks__chevron", attr: { "aria-hidden": "true" } }, "›"),
    h("span", { class: "bookmarks__tab-label" }, "Bookmarks"),
  );
  const panel = h("div", { class: "bookmarks__panel" }, list);
  const el = h("aside", { class: "bookmarks", attr: { "aria-label": "Bookmarks" } }, tab, panel);

  return {
    el,
    refresh({ rows, open }) {
      const empty = rows.length === 0;
      const shown = open && !empty; // empty wins: nothing to show ⇒ stay collapsed
      el.classList.toggle("bookmarks--open", shown);
      el.classList.toggle("bookmarks--empty", empty);
      tab.disabled = empty;
      tab.setAttribute("aria-expanded", String(shown));
      list.replaceChildren(
        ...rows.map((row) =>
          h(
            "li",
            {
              class: `bookmark-row${row.predicted ? " bookmark-row--predicted" : ""}`,
              attr: { role: "button", tabindex: "0" },
              on: { click: () => onWarp(row.date) },
            },
            h("span", { class: "bookmark-row__date" }, formatDate(row.date)),
            h(
              "ul",
              { class: "bookmark-row__atoms" },
              ...row.atoms.map(({ atom, kind }) =>
                h("li", { class: `bookmark-atom bookmark-atom--${kind}` }, atom.name),
              ),
            ),
          ),
        ),
      );
    },
  };
}
