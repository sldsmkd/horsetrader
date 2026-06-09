/**
 * The Forecast widget: the commit shield's "what outcome does that buy?" answer — a
 * little bar chart of the target-copy distribution (select/forecast.ts), reactive to
 * the pity stepper via an `{ el, update }` handle (the Resources-card pattern). The
 * spark floor is rendered as filled (guaranteed) bars; the random extras taper off to
 * the right, with the top bar carrying the whole ≥-cap tail.
 *
 * The chart starts at *one* copy — committing in pity is exactly what takes "0 copies"
 * off the table (the spark guarantees a copy), so that bar would always be empty. The
 * axis is kind-aware: **support** copies read as limit-break levels (0LB·1LB·2LB·3LB·MLB,
 * one copy = 0LB), while **trainees** stay plain copy counts (you don't limit-break a
 * trainee).
 */

import "./forecast.css";

import { h } from "../h.ts";
import { forecast, expectedCopies, type ForecastInput } from "../select/forecast.ts";
import type { BannerKind } from "../select/aboveLane.ts";

export interface ForecastWidget {
  el: HTMLElement;
  /** Re-draw the distribution for a committed pity (called from the shield's render). */
  update(pity: number): void;
}

/** Bottom-axis label for a copy count — limit-break levels for supports (one copy =
 *  0LB, the cap = MLB), plain counts for trainees (no limit break), top bar = ≥-tail. */
const barLabel = (copies: number, max: number, kind: BannerKind): string =>
  kind === "support" ? (copies === max ? "MLB" : `${copies - 1}LB`) : copies === max ? `${max}+` : String(copies);

export function forecastWidget(base: Omit<ForecastInput, "pity">, kind: BannerKind): ForecastWidget {
  // One handle per *rendered* bar — copies 1..maxCopies (the 0-copy bar is dropped).
  const handles: { fill: HTMLElement; pct: HTMLElement }[] = [];
  const chart = h("div", { class: "forecast__chart" });

  for (let copies = 1; copies <= base.maxCopies; copies++) {
    const fill = h("div", { class: "forecast__fill" });
    const pct = h("span", { class: "forecast__pct" });
    handles.push({ fill, pct });
    chart.append(
      h(
        "div",
        { class: "forecast__bar" },
        pct,
        h("div", { class: "forecast__track" }, fill),
        h("span", { class: "forecast__count" }, barLabel(copies, base.maxCopies, kind)),
      ),
    );
  }

  const caption = h("p", { class: "forecast__caption" });
  const el = h("div", { class: "forecast" }, chart, caption);

  const update = (pity: number): void => {
    const dist = forecast({ ...base, pity });
    // handles[i] is copies i+1 — the dropped 0-copy bar shifts the indexing by one.
    for (let i = 0; i < handles.length; i++) {
      const { prob, guaranteed } = dist[i + 1];
      handles[i].fill.style.height = `${(prob * 100).toFixed(2)}%`;
      handles[i].fill.classList.toggle("forecast__fill--guaranteed", guaranteed);
      // Hide sub-half-percent noise so tiny tails don't print "0%".
      handles[i].pct.textContent = prob >= 0.005 ? `${Math.round(prob * 100)}%` : "";
    }
    // The headline is **expected copies** — a single unit across both kinds (the
    // support copies↔LB and trainee count distinction stays on the bar axis only).
    // At zero pity it reads a plain 0.0 (no copies planned) rather than a placeholder.
    caption.textContent = `≈ ${expectedCopies({ ...base, pity }).toFixed(1)} expected copies`;
  };

  return { el, update };
}
