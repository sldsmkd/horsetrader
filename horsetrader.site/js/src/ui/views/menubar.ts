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
import type { ResourceVector } from "../../core/projection/index.ts";
import { pressedGroup } from "../widgets/pressedGroup.ts";

/** A member of the right-hand surface group. The left group (identity) is a
 *  single button, so it takes a plain boolean. */
export type RightSurface = "resources" | "tazuna";

export interface Menubar {
  readonly el: HTMLElement;
  setDate(date: string): void;
  setResources(resources: ResourceVector): void;
  setIdentity(identity: MenubarIdentity): void;
  /** Highlight the left group (identity) as open or not. */
  setLeftActive(active: boolean): void;
  /** Highlight which right-group surface is open (balance/tazuna), or none. */
  setRightActive(member: RightSurface | null): void;
  /** Lock the surface-spawning buttons while a shield (modal child window) is up.
   *  Navigation (home, search) stays live; so do the independent higher layers
   *  (bookmarks, minimap, timeline). A shield is modal only against its peers —
   *  the other menu surfaces it could otherwise spawn over. */
  setShielded(shielded: boolean): void;
}

export interface MenubarIdentity {
  label: string;
  icon: string;
}

export interface MenubarOpts {
  initialDate: string;
  initialResources: ResourceVector;
  identity: MenubarIdentity;
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
  const balanceValue = h("span", { class: "menubar__balance-value" }, formatBalance(opts.initialResources.free_carats ?? 0));
  const balance = h(
    "button",
    {
      class: "menubar__item menubar__button menubar__balance",
      attr: { type: "button" },
      on: { click: opts.onResources },
    },
    h("span", { class: "menubar__balance-primary" },
      balanceValue,
      h("span", { class: "menubar__balance-unit" }, "carats"),
    ),
  );
  const search = searchBox({ search: opts.search, onSearch: opts.onSearch });
  const identityIcon = h("img", {
    class: "menubar__identity-icon",
    attr: { src: opts.identity.icon, alt: "", width: 32, height: 32 },
  });
  const identityName = h("span", { class: "menubar__identity-name" }, opts.identity.label);

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
    identityName,
  );
  const plan = menuButton("Plan", opts.onPlan);
  const tazuna = menuButton("Tazuna", opts.onTazuna);
  // Plan is not built yet — keep it visibly inert rather than letting a click
  // tear down the real cards. Flip this off when the planner surface lands.
  plan.disabled = true;
  plan.title = "Coming soon";

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

  // Two independent highlight groups: the left group is the single identity
  // button (a plain on/off), the right group is a pressed-group over its members
  // (at most one lit). Both can be lit at once — left and right are independent.
  const setRightPressed = pressedGroup(
    new Map<RightSurface, HTMLElement>([
      ["resources", balance],
      ["tazuna", tazuna],
    ]),
    "menubar__button--active",
  );

  function setLeftActive(active: boolean): void {
    identity.setAttribute("aria-pressed", String(active));
    identity.classList.toggle("menubar__button--active", active);
  }
  setLeftActive(false);
  setRightPressed(null);

  // The surface spawners a shield locks — every *live* menu item that opens a
  // same-layer surface (not home/search, which are navigation). Plan is inert for
  // now, so there's nothing to lock there.
  const lockable: HTMLButtonElement[] = [identity, balance, tazuna];
  function setShielded(shielded: boolean): void {
    for (const button of lockable) {
      button.disabled = shielded;
      button.classList.toggle("menubar__button--shielded", shielded);
    }
  }

  return {
    el,
    setDate: (next) => {
      date.textContent = formatDate(next);
    },
    setResources: (resources) => {
      balanceValue.textContent = formatBalance(resources.free_carats ?? 0);
    },
    setIdentity: (next) => {
      identity.setAttribute("aria-label", `Identity: ${next.label}`);
      identityIcon.src = next.icon;
      identityName.textContent = next.label;
    },
    setLeftActive,
    setRightActive: (member) => setRightPressed(member),
    setShielded,
  };
}
