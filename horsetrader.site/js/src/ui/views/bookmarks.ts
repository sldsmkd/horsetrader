/**
 * The bookmarks drawer — favourites as navigation (ui.md "Bookmarks"). A
 * collapsible docked panel summoned by a chevron tab; each row warps the timeline
 * to a future appearance of a favourited atom. It is **layer-2 chrome** alongside
 * the menubar and minimap: non-blocking (it locks nothing and is locked by
 * nothing), painted *under* the surfaces it shares the top-left zone with, and the
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
import type { BookmarkRow } from "../select/bookmarks.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";
import type { PlannerRow } from "../select/planner.ts";
import { bookmarkCard } from "./widgets/bookmarkCard.ts";
import type { BookmarkCard } from "./widgets/bookmarkCard.ts";
import { plannerCard } from "./widgets/plannerCard.ts";

export type BookmarksFace = "favourites" | "planner";

export interface BookmarksHandlers {
  /** Toggle the drawer open/collapsed (the chevron tab). */
  onToggle(): void;
  /** Warp the timeline view to the next cyclic appearance for this row. */
  onWarp(row: BookmarkRow): void;
  /** Warp the timeline view to a planned banner. */
  onPlannerWarp(date: CalendarDate): void;
  /** Open the commit dossier for a planned banner. */
  onPlannerCommit(bannerKey: string): void;
  /** Flip the shared drawer slot between favourites and committed banners. */
  onFace(face: BookmarksFace): void;
}

/** What `refresh` needs: the derived rows and whether the drawer is open. */
export interface BookmarksRefresh {
  rows: readonly BookmarkRow[];
  plannerRows: readonly PlannerRow[];
  open: boolean;
  face: BookmarksFace;
}

export interface Bookmarks {
  /** The always-mounted drawer (collapses to its tab). */
  readonly el: HTMLElement;
  /** Re-render rows + open state — the render path (favourites/view-state changed). */
  refresh(p: BookmarksRefresh): void;
  /** Cheap-path update: view centre moved, so visible next-target dates may change. */
  setView(date: CalendarDate): void;
}

export function bookmarks({ onToggle, onWarp, onPlannerWarp, onPlannerCommit, onFace }: BookmarksHandlers): Bookmarks {
  const list = h("ul", { class: "bookmarks__list" });
  const emptyHint = h("li", { class: "bookmarks__empty" }, "Add favourites by clicking the star on a banner.");
  const plannerEmptyHint = h("li", { class: "bookmarks__empty" }, "Commit pities on a banner to add it to the planner.");
  let cards: BookmarkCard[] = [];
  let viewDate: CalendarDate | null = null;
  const tab = h(
    "button",
    {
      class: "bookmarks__tab",
      attr: { type: "button", "aria-label": "Favourites", "aria-expanded": "false" },
      on: { click: onToggle },
    },
    h("span", { class: "bookmarks__tab-icon bookmarks__tab-icon--favourites", attr: { "aria-hidden": "true" } }, "★"),
    h("span", { class: "bookmarks__chevron", attr: { "aria-hidden": "true" } }, "›"),
    h("span", { class: "bookmarks__tab-icon bookmarks__tab-icon--plan", attr: { "aria-hidden": "true" } }, "📋"),
  );
  const close = h("button", { class: "bookmarks__close", attr: { type: "button", "aria-label": "Close" }, on: { click: onToggle } }, "×");
  const panelHeader = h("div", { class: "bookmarks__panel-header" }, close);
  const favouritesTab = h(
    "button",
    {
      class: "bookmarks__face-tab",
      attr: { type: "button", role: "tab", "aria-selected": "true" },
      on: { click: () => onFace("favourites") },
    },
    "Favourites",
  );
  const planTab = h(
    "button",
    {
      class: "bookmarks__face-tab",
      attr: { type: "button", role: "tab", "aria-selected": "false" },
      on: { click: () => onFace("planner") },
    },
    "Plan",
  );
  const faceTabs = h("div", { class: "bookmarks__face-tabs", attr: { role: "tablist", "aria-label": "Favourites bar face" } }, favouritesTab, planTab);
  panelHeader.replaceChildren(faceTabs, close);
  const header = h("div", { class: "bookmarks__header" }, tab, panelHeader);
  const panel = h("div", { class: "bookmarks__panel" }, list);
  const el = h("aside", { class: "bookmarks", attr: { "aria-label": "Favourites and planner" } }, header, panel);

  return {
    el,
    refresh({ rows, plannerRows, open, face }) {
      const showingPlanner = face === "planner";
      const visibleRows = showingPlanner ? plannerRows : rows;
      const empty = visibleRows.length === 0;
      el.classList.toggle("bookmarks--open", open);
      el.classList.toggle("bookmarks--empty", empty);
      el.classList.toggle("bookmarks--planner", showingPlanner);
      tab.disabled = false;
      tab.setAttribute("aria-expanded", String(open));
      favouritesTab.setAttribute("aria-selected", String(!showingPlanner));
      planTab.setAttribute("aria-selected", String(showingPlanner));
      cards = [];
      if (empty) {
        list.replaceChildren(showingPlanner ? plannerEmptyHint : emptyHint);
        return;
      }
      if (showingPlanner) {
        list.replaceChildren(
          ...plannerRows.map((row) =>
            h(
              "li",
              { class: `bookmark-row${row.predicted ? " bookmark-row--predicted" : ""}` },
              plannerCard({ row, onWarp: onPlannerWarp, onCommit: onPlannerCommit }),
            ),
          ),
        );
        return;
      }
      list.replaceChildren(
        ...rows.map((row) => {
          const predicted = row.appearances.some((appearance) => appearance.predicted);
          const card = bookmarkCard({ row, onWarp });
          cards.push(card);
          if (viewDate) card.setView(viewDate);
          return h(
            "li",
            { class: `bookmark-row${predicted ? " bookmark-row--predicted" : ""}` },
            card.el,
          );
        }),
      );
    },
    setView(date) {
      viewDate = date;
      for (const card of cards) card.setView(date);
    },
  };
}
