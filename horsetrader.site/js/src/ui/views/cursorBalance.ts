/**
 * The cursor balance readout — the smallest real view, the one that proves the
 * loop (docs/frontend/interaction.md, build order step 3). It shows the carat
 * balance at the cursor's date.
 *
 * It is built once and updated through `setBalance` / `setDate`, never rebuilt.
 * That single cheap update path is what lets it answer to BOTH tiers of the
 * change model: a scrub calls it directly (the cheap path) and a domain
 * recompute calls it from the coordinator subscription (the render path) — and
 * neither tears the node down. The view owns no state and reads nothing back out
 * of the DOM; the shell hands it the numbers.
 */

import "./cursorBalance.css";

import { h } from "../h.ts";
import { formatBalance } from "../format.ts";
import type { ResourceVector } from "../../core/projection/index.ts";

export interface CursorBalance {
  readonly el: HTMLElement;
  /** Write the balance for the current cursor. Cheap; called on both tiers. */
  setBalance(balance: ResourceVector): void;
  /** Write the cursor's date label. */
  setDate(date: string): void;
}

export function cursorBalance(): CursorBalance {
  const date = h("span", { class: "cursor-balance__date" });
  const value = h("span", { class: "cursor-balance__value" });
  const el = h(
    "div",
    { class: "cursor-balance" },
    h("span", { class: "cursor-balance__label" }, "Carats at "),
    date,
    ": ",
    value,
  );
  return {
    el,
    setBalance: (balance) => {
      value.textContent = formatBalance(balance.free_carats ?? 0);
    },
    setDate: (d) => {
      date.textContent = d;
    },
  };
}
