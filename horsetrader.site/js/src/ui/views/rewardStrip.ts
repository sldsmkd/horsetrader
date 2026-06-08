import "./rewardStrip.css";

import { formatRewardLines } from "../format.ts";
import { h } from "../h.ts";

export function rewardStrip(rewards: Record<string, number | undefined>): HTMLElement | null {
  const lines = formatRewardLines(rewards);
  if (lines.length === 0) return null;

  const children: HTMLElement[] = [];
  lines.forEach((reward, index) => {
    if (index > 0) {
      children.push(h("span", { class: "reward-strip__separator", attr: { "aria-hidden": "true" } }, "|"));
    }
    children.push(
      h(
        "span",
        { class: `reward-strip__item reward-strip__item--${reward.key.replaceAll("_", "-")}` },
        reward.icon
          ? h("img", {
              class: "reward-strip__icon",
              attr: { src: reward.icon, alt: reward.label, width: 256, height: 256, loading: "lazy", decoding: "async" },
            })
          : h("span", { class: "reward-strip__fallback-label" }, reward.label),
        h("span", { class: "reward-strip__amount" }, reward.amount),
      ),
    );
  });

  return h("footer", { class: "reward-strip", attr: { "aria-label": "Rewards" } }, ...children);
}
