/**
 * The menubar shell: persistent chrome floating over the live timeline. It owns
 * the shared strip structure, item sequence, responsive collapse, and the
 * callback seam for attached surfaces; the app shell decides what each action
 * means.
 */

import "./menubar.css";

import { h } from "../h.ts";
import { formatBalance, formatDate } from "../format.ts";
import { searchBox } from "./surfaces/searchBox.ts";
import type { SearchIndex, SearchResult } from "../query/index.ts";
import type { ResourceVector } from "../../core/projection/index.ts";
import { pressedGroup } from "./widgets/pressedGroup.ts";

/** A member of the right-hand surface group. The left group (identity) is a
 *  single button, so it takes a plain boolean. */
export type RightSurface = "resources" | "beta";

export interface Menubar {
  readonly el: HTMLElement;
  setDate(date: string): void;
  setResources(resources: ResourceVector): void;
  setIdentity(identity: MenubarIdentity): void;
  /** Highlight the left group (identity) as open or not. */
  setLeftActive(active: boolean): void;
  /** Highlight which right-group surface is open (balance), or none. */
  setRightActive(member: RightSurface | null): void;
  /** Reveal the Plan (tablet) button. The Desk has nothing to show with no
   *  commitments, so the door only appears once the plan is non-empty. */
  setPlanAvailable(available: boolean): void;
  /** Reveal the Beta (🔨) button — gated on the supporter entitlement, which the
   *  app watches off every cloud pull (so this flips at runtime, not construction). */
  setBetaAvailable(available: boolean): void;
  /** Lock the surface-spawning buttons while a modal (modal child window) is up.
   *  Navigation (home, search) stays live; so do the independent higher layers
   *  (bookmarks, minimap, timeline). A modal is modal only against its peers —
   *  the other menu surfaces it could otherwise spawn over. */
  setLocked(locked: boolean): void;
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
  onResources: () => void;
  /** The Plan (Desk) spawn seam — the tablet button left of the carat balance. A modal
   *  like the commit dossier (twinkle-monthly/cover.md). Shown only once `setPlanAvailable`
   *  reveals it (a commitment exists). */
  onPlan: () => void;
  /** The beta chamber's spawn seam — the gold-hammer button between Plan and the carat
   *  balance, revealing the chamber that hosts UmaMark (grand-masters/umamark.md). Gated
   *  on the supporter entitlement via `setBetaAvailable`, so it's hidden by default. */
  onBeta: () => void;
  search: SearchIndex;
  onSearch: (result: SearchResult) => void;
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
  // The Plan (Desk) door — a tablet button immediately left of the carat balance.
  // Hidden until a commitment exists (`setPlanAvailable`); the Desk has nothing to
  // render over an empty plan (twinkle-monthly/cover.md).
  const plan = h(
    "button",
    {
      class: "menubar__item menubar__button menubar__plan menubar__plan--hidden",
      attr: { type: "button", "aria-label": "Plan", title: "Plan" },
      on: { click: opts.onPlan },
    },
    h("img", { class: "menubar__plan-icon", attr: { src: "/icons/tablet.png", alt: "", width: 28, height: 28 } }),
  );

  const search = searchBox({ search: opts.search, onSearch: opts.onSearch });
  const identityIcon = h("img", {
    class: "menubar__identity-icon",
    attr: { src: opts.identity.icon, alt: "", width: 128, height: 128 },
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
  // Beta (🔨): the WIP isolation chamber that hosts UmaMark (grand-masters/umamark.md).
  // The gold-hammer button sits between Plan and the carat balance, hidden until
  // `setBetaAvailable` reveals it — gated on the supporter entitlement, which the app
  // watches off every cloud pull, so the button comes and goes at runtime (like Plan).
  const beta = h(
    "button",
    {
      class: "menubar__item menubar__button menubar__beta menubar__beta--hidden",
      attr: { type: "button", "aria-label": "Beta", title: "Beta" },
      on: { click: opts.onBeta },
    },
    h("img", { class: "menubar__beta-icon", attr: { src: "/icons/gold_hammer.png", alt: "", width: 28, height: 28 } }),
  );

  const rightCluster = h("div", { class: "menubar__cluster menubar__cluster--right" }, plan, beta, balance);

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
    rightCluster,
  );

  // Two independent highlight groups: the left group is the single identity
  // button (a plain on/off), the right group is a pressed-group over its members
  // (at most one lit). Both can be lit at once — left and right are independent.
  const rightMembers = new Map<RightSurface, HTMLElement>([["resources", balance], ["beta", beta]]);
  const setRightPressed = pressedGroup(rightMembers, "menubar__button--active");

  function setLeftActive(active: boolean): void {
    identity.setAttribute("aria-pressed", String(active));
    identity.classList.toggle("menubar__button--active", active);
  }
  setLeftActive(false);
  setRightPressed(null);

  // The surface spawners a modal locks — every *live* menu item that opens a
  // same-layer surface (not home/search, which are navigation).
  const lockable: HTMLButtonElement[] = [identity, plan, beta, balance];
  function setLocked(locked: boolean): void {
    for (const button of lockable) {
      button.disabled = locked;
      button.classList.toggle("menubar__button--locked", locked);
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
    setPlanAvailable: (available) => plan.classList.toggle("menubar__plan--hidden", !available),
    setBetaAvailable: (available) => beta.classList.toggle("menubar__beta--hidden", !available),
    setLocked,
  };
}
