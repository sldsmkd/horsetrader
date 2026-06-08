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
import type { SearchIndex, SearchResult } from "../query/index.ts";
import { pressedGroup } from "../widgets/pressedGroup.ts";

export type MenubarOverlay = "identity" | "plan" | "resources" | "tazuna" | null;

export interface Menubar {
  readonly el: HTMLElement;
  setDate(date: string): void;
  setBalance(carats: number): void;
  setIdentity(identity: MenubarIdentity): void;
  setOpenOverlay(overlay: MenubarOverlay): void;
}

export interface MenubarIdentity {
  label: string;
  icon: string;
}

export interface MenubarOpts {
  initialDate: string;
  initialBalance: number;
  identity: MenubarIdentity;
  openOverlay: MenubarOverlay;
  onHome: () => void;
  onIdentity: () => void;
  onPlan: () => void;
  onResources: () => void;
  onTazuna: () => void;
  search: SearchIndex;
  onSearch: (result: SearchResult) => void;
}

function menuButton(label: string, onClick: () => void): HTMLButtonElement {
  return h(
    "button",
    {
      class: "menubar__item menubar__button",
      attr: { type: "button" },
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
      attr: { type: "button" },
      on: { click: opts.onResources },
    },
    h("span", { class: "menubar__balance-value" }, formatBalance(opts.initialBalance)),
    h("span", { class: "menubar__balance-unit" }, "carats"),
  );
  const search = searchBox({ search: opts.search, onSearch: opts.onSearch });
  const identityIcon = h("img", {
    class: "menubar__identity-icon",
    attr: { src: opts.identity.icon, alt: "", width: 32, height: 32 },
  });

  const identity = h(
    "button",
    {
      class: "menubar__item menubar__button menubar__identity",
      attr: {
        type: "button",
        "aria-label": `Identity: ${opts.identity.label}`,
        title: "Identity",
      },
      on: { click: opts.onIdentity },
    },
    identityIcon,
  );
  const plan = menuButton("Plan", opts.onPlan);
  const tazuna = menuButton("Tazuna", opts.onTazuna);

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

  const overlayButtons = new Map<Exclude<MenubarOverlay, null>, HTMLElement>([
    ["identity", identity],
    ["plan", plan],
    ["resources", balance],
    ["tazuna", tazuna],
  ]);
  const setPressed = pressedGroup(overlayButtons, "menubar__button--active");

  function setOpenOverlay(open: MenubarOverlay): void {
    setPressed(open);
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
    setIdentity: (next) => {
      identity.setAttribute("aria-label", `Identity: ${next.label}`);
      identityIcon.src = next.icon;
    },
    setOpenOverlay,
  };
}
