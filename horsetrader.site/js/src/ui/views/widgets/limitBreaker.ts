/**
 * The limit-breaker meter widget: a self-contained read of one crystal track. You
 * hand it the whole crystals and loose shards you hold; it owns the arithmetic —
 * 20 shards craft a crystal, so it normalises (shards ≥ 20 roll up), then renders
 * the `whole + rem/20 (ratio)` readout and a bar filled to the fractional crystal.
 * Both the readout and the bar derive from the same numbers, so they can never
 * drift. Caller supplies only identity (name, icon, colour variant) + the counts.
 */

import "./limitBreaker.css";

import { h } from "../../h.ts";

/** Shards that craft one crystal — the meter's denominator. */
export const SHARDS_PER_CRYSTAL = 20;

export interface LimitBreakerOpts {
  name: string;
  icon: string;
  /** Colour hook for later; wireframe renders all variants monochrome. */
  variant: "rainbow" | "gold";
  crystals: number;
  shards: number;
}

export function limitBreaker(opts: LimitBreakerOpts): HTMLElement {
  const totalShards = opts.crystals * SHARDS_PER_CRYSTAL + opts.shards;
  const whole = Math.floor(totalShards / SHARDS_PER_CRYSTAL);
  const rem = totalShards % SHARDS_PER_CRYSTAL;
  const ratio = totalShards / SHARDS_PER_CRYSTAL;
  const fill = (rem / SHARDS_PER_CRYSTAL) * 100;

  return h(
    "div",
    { class: "limit-breaker" },
    h("img", { class: "limit-breaker__icon", attr: { src: opts.icon, alt: "", width: 32, height: 32 } }),
    h(
      "div",
      { class: "limit-breaker__body" },
      h(
        "div",
        { class: "limit-breaker__head" },
        h("span", { class: "limit-breaker__name" }, opts.name),
        h(
          "span",
          { class: "limit-breaker__readout" },
          h("strong", `${whole} + ${rem}/${SHARDS_PER_CRYSTAL}`),
          h("span", { class: "limit-breaker__ratio" }, `(${ratio.toFixed(2)})`),
        ),
      ),
      h(
        "div",
        { class: `limit-breaker__bar limit-breaker__bar--${opts.variant}` },
        h("div", { class: "limit-breaker__bar-fill", attr: { style: `width: ${fill}%` } }),
      ),
    ),
  );
}
