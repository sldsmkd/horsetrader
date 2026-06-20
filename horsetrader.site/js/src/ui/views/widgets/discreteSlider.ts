import "./discreteSlider.css";

import { h } from "../../h.ts";

export interface DiscreteSliderStep {
  value: string;
  description: string;
}

export interface DiscreteSliderOpts {
  title: string;
  steps: readonly DiscreteSliderStep[];
  selected: number;
  locked: boolean;
  onChange?: (selected: number) => void;
}

// A safe placeholder so a missing/undefined step can never crash the component.
// Callers should pass complete steps (see playStyleSurface's keys↔strings guard);
// this is the last line of defence — a bad index degrades to a blank step, not a
// `Cannot read properties of undefined (reading 'value')` that takes the surface down.
const FALLBACK_STEP: DiscreteSliderStep = { value: "—", description: "" };

export function discreteSlider(opts: DiscreteSliderOpts): HTMLElement {
  // Clamp into range AND coalesce, in case the steps array itself has holes
  // (a keys/strings drift upstream) — selected stays valid but the entry may be undefined.
  const selected = Math.max(0, Math.min(opts.selected, opts.steps.length - 1));
  const step = opts.steps[selected] ?? FALLBACK_STEP;
  const rangeAttr = opts.locked
    ? { type: "range", min: 0, max: opts.steps.length - 1, step: 1, value: selected, disabled: true }
    : { type: "range", min: 0, max: opts.steps.length - 1, step: 1, value: selected };

  const value = h("span", { class: "discrete-slider__value" }, step.value);
  const description = h("p", { class: "discrete-slider__description" }, step.description);
  let range: HTMLInputElement;
  const updateSelected = (next: number): void => {
    const clamped = Math.max(0, Math.min(next, opts.steps.length - 1));
    const nextStep = opts.steps[clamped] ?? step;
    value.textContent = nextStep.value;
    description.textContent = nextStep.description;
    range.value = String(clamped);
    range.setAttribute("aria-valuetext", nextStep.value);
    opts.onChange?.(clamped);
  };
  const stepFromPointer = (ev: PointerEvent): number => {
    const rect = range.getBoundingClientRect();
    const x = Math.max(0, Math.min(ev.clientX - rect.left, rect.width));
    return Math.round((x / rect.width) * (opts.steps.length - 1));
  };
  range = h("input", {
    class: "discrete-slider__range",
    attr: {
      ...rangeAttr,
      "aria-label": opts.title,
      "aria-valuetext": step.value,
    },
    on: {
      input: (ev) => {
        const input = ev.currentTarget as HTMLInputElement;
        updateSelected(input.valueAsNumber);
      },
      pointerdown: (ev) => {
        if (!opts.locked) updateSelected(stepFromPointer(ev));
      },
    },
  });

  return h(
    "div",
    { class: "discrete-slider" },
    opts.locked
      ? h("span", { class: "discrete-slider__lock", attr: { role: "img", "aria-label": "Locked" } })
      : h("span", { class: "discrete-slider__lock discrete-slider__lock--unlocked", attr: { "aria-hidden": "true" } }),
    h(
      "div",
      { class: "discrete-slider__body" },
      h(
        "div",
        { class: "discrete-slider__header" },
        h("span", { class: "discrete-slider__title" }, opts.title),
        value,
      ),
      description,
      h(
        "div",
        { class: "discrete-slider__control" },
        range,
      ),
    ),
  );
}
