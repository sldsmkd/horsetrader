import "./checkbox.css";

import { h } from "../../h.ts";

export interface CheckboxOpts {
  title: string;
  checked: boolean;
  /** Read-only (preset-driven): greyed and non-interactive. Custom unlocks it. */
  locked: boolean;
  /** Called with the new checked state. The box updates itself in place first. */
  onToggle?: (checked: boolean) => void;
}

/**
 * A binary play-style gate for the passive streams (dailies, holidays, …). When
 * `locked` it greys out and ignores clicks — the preset twin of
 * `discreteSlider({ locked: true })`; when unlocked (Custom) it toggles on click,
 * updating its own visual (like the slider does) so no surrounding re-render is
 * needed. Several share a drawer row, so it stays a fraction of a slider's height.
 */
export function checkbox(opts: CheckboxOpts): HTMLElement {
  let el: HTMLButtonElement;
  el = h(
    "button",
    {
      class: ["checkbox", opts.checked && "checkbox--on", opts.locked && "checkbox--locked"]
        .filter(Boolean)
        .join(" "),
      attr: {
        type: "button",
        role: "checkbox",
        "aria-checked": String(opts.checked),
        ...(opts.locked ? { "aria-disabled": "true", disabled: true } : {}),
      },
      on: opts.locked
        ? {}
        : {
            click: () => {
              const next = el.getAttribute("aria-checked") !== "true";
              el.classList.toggle("checkbox--on", next);
              el.setAttribute("aria-checked", String(next));
              opts.onToggle?.(next);
            },
          },
    },
    h("span", { class: "checkbox__box", attr: { "aria-hidden": "true" } }),
    h("span", { class: "checkbox__label" }, opts.title),
  );
  return el;
}
