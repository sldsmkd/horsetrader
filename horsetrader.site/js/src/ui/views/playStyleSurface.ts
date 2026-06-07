import "./playStyleSurface.css";

import { h } from "../h.ts";
import { PLAY_STYLES } from "./identitySurface.ts";
import type { PlayStyleKey } from "./identitySurface.ts";

interface AssumptionRow {
  label: string;
  value: string;
}

interface PlayStyleDetails {
  archetype: string;
  shape: string;
  assumptions: readonly AssumptionRow[];
}

const DETAILS: Record<Exclude<PlayStyleKey, "custom">, PlayStyleDetails> = {
  sweetie: {
    archetype: "Weekend / occasional player",
    shape: "Not daily, avoids chore grinds, still notices some shiny events.",
    assumptions: [
      { label: "Baseline engagement", value: "2 of 7 days" },
      { label: "Team Trials", value: "Rank 4" },
      { label: "Legend Races", value: "1 legend" },
      { label: "Rotating missions", value: "0%" },
      { label: "Special missions", value: "60%" },
      { label: "Story events", value: "Story" },
      { label: "Champions Meeting", value: "Skips or does not finish" },
    ],
  },
  casual: {
    archetype: "Regular player with real-life interruptions",
    shape: "Low consistency, high festival response; big events fund the gacha moments.",
    assumptions: [
      { label: "Baseline engagement", value: "4 of 7 days" },
      { label: "Team Trials", value: "Rank 5" },
      { label: "Legend Races", value: "1 legend" },
      { label: "Rotating missions", value: "20%" },
      { label: "Special missions", value: "80%" },
      { label: "Story events", value: "Welfare card" },
      { label: "Champions Meeting", value: "Group B contender" },
    ],
  },
  focused: {
    archetype: "Daily-intent player",
    shape: "Usually keeps up, sometimes misses, builds for events without exhausting every edge.",
    assumptions: [
      { label: "Baseline engagement", value: "6 of 7 days" },
      { label: "Team Trials", value: "Rank 5.5 promote-demote" },
      { label: "Legend Races", value: "All legends, partial daily rewards" },
      { label: "Rotating missions", value: "70%" },
      { label: "Special missions", value: "90%" },
      { label: "Story events", value: "Major rewards" },
      { label: "Champions Meeting", value: "Group B winner" },
    ],
  },
  dedicated: {
    archetype: "Daily player",
    shape: "Reliable, completes chores, prepares seriously for PvP, but not assumed champion ceiling.",
    assumptions: [
      { label: "Baseline engagement", value: "7 of 7 days" },
      { label: "Team Trials", value: "Rank 6" },
      { label: "Legend Races", value: "All legends, full daily rewards" },
      { label: "Rotating missions", value: "100%" },
      { label: "Special missions", value: "100%" },
      { label: "Story events", value: "Achievement / stretch" },
      { label: "Champions Meeting", value: "Group A runner-up" },
    ],
  },
  unhinged: {
    archetype: "Competitive ceiling player",
    shape: "Chases ceiling outcomes through grind volume, optimization, account investment, or some combination.",
    assumptions: [
      { label: "Baseline engagement", value: "7 of 7 days" },
      { label: "Team Trials", value: "Rank 6" },
      { label: "Legend Races", value: "All legends, full daily rewards" },
      { label: "Rotating missions", value: "100%" },
      { label: "Special missions", value: "100%" },
      { label: "Story events", value: "Achievement / stretch, early" },
      { label: "Champions Meeting", value: "Group A champion" },
    ],
  },
};

export interface PlayStyleSurfaceOpts {
  playStyleKey: PlayStyleKey;
  savedPlayStyleKey: PlayStyleKey;
  onApply: (key: PlayStyleKey) => void;
}

function selectedStyle(key: PlayStyleKey): (typeof PLAY_STYLES)[number] {
  return PLAY_STYLES.find((style) => style.key === key) ?? PLAY_STYLES[2];
}

function detailsFor(key: PlayStyleKey): PlayStyleDetails {
  if (key === "custom") {
    return {
      archetype: "Player-edited assumptions",
      shape: "Custom controls will unlock here later for off-diagonal play patterns.",
      assumptions: [
        { label: "Baseline engagement", value: "Custom" },
        { label: "Team Trials", value: "Custom" },
        { label: "Legend Races", value: "Custom" },
        { label: "Rotating missions", value: "Custom" },
        { label: "Special missions", value: "Custom" },
        { label: "Story events", value: "Custom" },
        { label: "Champions Meeting", value: "Custom" },
      ],
    };
  }
  return DETAILS[key];
}

export function playStyleSurface(opts: PlayStyleSurfaceOpts): HTMLElement {
  const style = selectedStyle(opts.playStyleKey);
  const details = detailsFor(opts.playStyleKey);
  const locked = opts.playStyleKey !== "custom";
  const current = opts.playStyleKey === opts.savedPlayStyleKey;
  const applyAttr = current
    ? { type: "button", disabled: true, "aria-disabled": "true" }
    : { type: "button", "aria-disabled": "false" };

  return h(
    "section",
    { class: "playstyle-surface" },
    h(
      "div",
      { class: "playstyle-surface__mast" },
      h(
        "span",
        { class: "playstyle-surface__icon" },
        h("img", { attr: { src: style.icon, alt: "", width: 64, height: 64 } }),
      ),
      h(
        "div",
        { class: "playstyle-surface__copy" },
        h("span", { class: "playstyle-surface__eyebrow" }, locked ? "Locked preset" : "Custom preset"),
        h("h2", { class: "playstyle-surface__title" }, style.name),
        h("p", { class: "playstyle-surface__archetype" }, details.archetype),
      ),
    ),
    h("p", { class: "playstyle-surface__shape" }, details.shape),
    h(
      "div",
      { class: "playstyle-surface__assumptions" },
      ...details.assumptions.map((row) =>
        h(
          "div",
          { class: "playstyle-surface__row" },
          h("span", {
            class: [
              "playstyle-surface__lock",
              !locked && "playstyle-surface__lock--unlocked",
            ].filter(Boolean).join(" "),
            attr: { role: "img", "aria-label": locked ? "Locked" : "Editable" },
          }),
          h("span", { class: "playstyle-surface__label" }, row.label),
          h("span", { class: "playstyle-surface__value" }, row.value),
        ),
      ),
    ),
    h(
      "div",
      { class: "playstyle-surface__actions" },
      h(
        "button",
        {
          class: [
            "playstyle-surface__apply",
            current && "playstyle-surface__apply--disabled",
          ].filter(Boolean).join(" "),
          attr: applyAttr,
          on: {
            click: () => {
              if (!current) opts.onApply(opts.playStyleKey);
            },
          },
        },
        "Apply",
      ),
    ),
  );
}
