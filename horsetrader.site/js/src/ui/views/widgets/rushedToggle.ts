import "./rushedToggle.css";

import { h } from "../../h.ts";

export interface RushedToggleOptions {
  pressed?: boolean;
  onChange?: (pressed: boolean) => void;
}

/**
 * The persisted-rush seam handed to the dumb card views: read whether an event is
 * currently rushed, and flip it. The views stay DOM-only — app.ts binds this to
 * the coordinator's document (`rushed` map). Keyed by ETL stable event key.
 */
export interface RushBinding {
  isRushed: (eventKey: string) => boolean;
  setRushed: (eventKey: string, rushed: boolean) => void;
}

/** Build a rushed toggle bound to one event key through a `RushBinding`. */
export function rushedToggleFor(rush: RushBinding, eventKey: string): HTMLElement {
  return rushedToggle({ pressed: rush.isRushed(eventKey), onChange: (on) => rush.setRushed(eventKey, on) });
}

export function rushedToggle({ pressed = false, onChange }: RushedToggleOptions = {}): HTMLElement {
  const btn = h(
    "button",
    {
      class: "rushed-toggle",
      attr: {
        type: "button",
        role: "checkbox",
        "aria-checked": pressed,
        "aria-label": "Completed",
        title: "Completed",
      },
      on: {
        // The button lives inside the timeline, which captures the pointer on
        // pointerdown to pan — that capture would retarget the click to the
        // timeline and the toggle would never fire. Keep the press local.
        pointerdown: (ev) => ev.stopPropagation(),
        click: () => {
          const next = btn.getAttribute("aria-checked") !== "true";
          btn.setAttribute("aria-checked", String(next));
          btn.classList.toggle("rushed-toggle--on", next);
          onChange?.(next);
        },
      },
    },
    h("span", { class: "rushed-toggle__box", attr: { "aria-hidden": "true" } }),
  );

  if (pressed) btn.classList.add("rushed-toggle--on");

  return btn;
}
