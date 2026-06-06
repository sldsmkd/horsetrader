/**
 * The menubar shell: persistent chrome floating over the live timeline. It owns
 * the shared strip structure, item sequence, responsive collapse, and the
 * callback seam for attached surfaces; the app shell decides what each action
 * means.
 */

import "./menubar.css";

import { h } from "../h.ts";
import { formatBalance, formatDate } from "../format.ts";
import { searchBox } from "./searchBox.ts";
import type { SearchIndex, SearchResult } from "../search/index.ts";

export type MenubarOverlay = "identity" | "plan" | "resources" | "tazuna" | null;
const REPRESENTATIVE_ICON = "/img/characters/admire-groove_icon.webp";

export interface Menubar {
  readonly el: HTMLElement;
  setDate(date: string): void;
  setBalance(carats: number): void;
  setOpenOverlay(overlay: MenubarOverlay): void;
}

export interface MenubarOpts {
  initialDate: string;
  initialBalance: number;
  openOverlay: MenubarOverlay;
  onHome: () => void;
  onIdentity: () => void;
  onPlan: () => void;
  onResources: () => void;
  onTazuna: () => void;
  search: SearchIndex;
  onSearch: (result: SearchResult) => void;
}

function menuButton(label: string, overlay: Exclude<MenubarOverlay, null>, onClick: () => void): HTMLButtonElement {
  return h(
    "button",
    {
      class: "menubar__item menubar__button",
      attr: { type: "button", "data-overlay": overlay, "aria-pressed": "false" },
      on: { click: onClick },
    },
    label,
  );
}

export function menubar(opts: MenubarOpts): Menubar {
  const date = h("span", { class: "menubar__item menubar__date" }, formatDate(opts.initialDate));
  const balance = h(
    "button",
    {
      class: "menubar__item menubar__button menubar__balance",
      attr: { type: "button", "data-overlay": "resources", "aria-pressed": "false" },
      on: { click: opts.onResources },
    },
    h("span", { class: "menubar__balance-value" }, formatBalance(opts.initialBalance)),
    h("span", { class: "menubar__balance-unit" }, "carats"),
  );
  const search = searchBox({ search: opts.search, onSearch: opts.onSearch });

  const identity = h(
    "button",
    {
      class: "menubar__item menubar__button menubar__identity",
      attr: {
        type: "button",
        "data-overlay": "identity",
        "aria-pressed": "false",
        "aria-label": "Identity: Admire Groove",
        title: "Identity",
      },
      on: { click: opts.onIdentity },
    },
    h("img", { class: "menubar__identity-icon", attr: { src: REPRESENTATIVE_ICON, alt: "", width: 32, height: 32 } }),
  );
  const plan = menuButton("Plan", "plan", opts.onPlan);
  const tazuna = menuButton("Tazuna", "tazuna", opts.onTazuna);

  const el = h(
    "nav",
    { class: "menubar", attr: { "aria-label": "Timeline controls" } },
    h(
      "div",
      { class: "menubar__cluster menubar__cluster--left" },
      h(
        "button",
        {
          class: "menubar__item menubar__button menubar__home",
          attr: { type: "button", "aria-label": "Home", title: "Home" },
          on: { click: opts.onHome },
        },
        "🏠",
      ),
      date,
      identity,
    ),
    search,
    h("div", { class: "menubar__cluster menubar__cluster--right" }, plan, balance, tazuna),
  );

  function setOpenOverlay(open: MenubarOverlay): void {
    for (const button of el.querySelectorAll<HTMLButtonElement>("[data-overlay]")) {
      const active = button.dataset.overlay === open;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("menubar__button--active", active);
    }
  }
  setOpenOverlay(opts.openOverlay);

  return {
    el,
    setDate: (next) => {
      date.textContent = formatDate(next);
    },
    setBalance: (carats) => {
      const value = balance.querySelector(".menubar__balance-value");
      if (value) value.textContent = formatBalance(carats);
    },
    setOpenOverlay,
  };
}
