import "./playStyleSurface.css";

import { h } from "../h.ts";
import { discreteSlider } from "./discreteSlider.ts";
import { PLAY_STYLES } from "./playStylePreset.ts";
import type { PlayStyleKey } from "./playStylePreset.ts";
import { samePlayStyleSettings } from "../identity/playStyleSettings.ts";
import type { LegendRaceKey, PlayStyleSettings } from "../identity/playStyleSettings.ts";
import type { AssumptionStringKey, PlayStyleStrings } from "../strings.ts";

interface SliderRow {
  kind: "slider";
  key: "legendRaces";
}

interface AssumptionRow {
  kind: "row";
  key: AssumptionStringKey;
}

interface PlayStyleDetails {
  assumptions: readonly (AssumptionRow | SliderRow)[];
}

const LEGEND_RACE_KEYS: readonly LegendRaceKey[] = ["none", "one", "allPartial", "allFull"];

function legendRaceIndex(key: LegendRaceKey): number {
  return LEGEND_RACE_KEYS.indexOf(key);
}

function legendRaceKeyAt(index: number): LegendRaceKey {
  return LEGEND_RACE_KEYS[index] ?? "none";
}

const DETAILS: Record<Exclude<PlayStyleKey, "custom">, PlayStyleDetails> = {
  sweetie: {
    assumptions: [
      { kind: "row", key: "baselineEngagement" },
      { kind: "row", key: "teamTrials" },
      { kind: "slider", key: "legendRaces" },
      { kind: "row", key: "rotatingMissions" },
      { kind: "row", key: "specialMissions" },
      { kind: "row", key: "storyEvents" },
      { kind: "row", key: "championsMeeting" },
    ],
  },
  casual: {
    assumptions: [
      { kind: "row", key: "baselineEngagement" },
      { kind: "row", key: "teamTrials" },
      { kind: "slider", key: "legendRaces" },
      { kind: "row", key: "rotatingMissions" },
      { kind: "row", key: "specialMissions" },
      { kind: "row", key: "storyEvents" },
      { kind: "row", key: "championsMeeting" },
    ],
  },
  focused: {
    assumptions: [
      { kind: "row", key: "baselineEngagement" },
      { kind: "row", key: "teamTrials" },
      { kind: "slider", key: "legendRaces" },
      { kind: "row", key: "rotatingMissions" },
      { kind: "row", key: "specialMissions" },
      { kind: "row", key: "storyEvents" },
      { kind: "row", key: "championsMeeting" },
    ],
  },
  dedicated: {
    assumptions: [
      { kind: "row", key: "baselineEngagement" },
      { kind: "row", key: "teamTrials" },
      { kind: "slider", key: "legendRaces" },
      { kind: "row", key: "rotatingMissions" },
      { kind: "row", key: "specialMissions" },
      { kind: "row", key: "storyEvents" },
      { kind: "row", key: "championsMeeting" },
    ],
  },
  unhinged: {
    assumptions: [
      { kind: "row", key: "baselineEngagement" },
      { kind: "row", key: "teamTrials" },
      { kind: "slider", key: "legendRaces" },
      { kind: "row", key: "rotatingMissions" },
      { kind: "row", key: "specialMissions" },
      { kind: "row", key: "storyEvents" },
      { kind: "row", key: "championsMeeting" },
    ],
  },
};

export interface PlayStyleSurfaceOpts {
  playStyleKey: PlayStyleKey;
  savedPlayStyleKey: PlayStyleKey;
  settings: PlayStyleSettings;
  savedSettings: PlayStyleSettings;
  strings: PlayStyleStrings;
  onSettingsChange: (settings: PlayStyleSettings) => void;
  onApply: (key: PlayStyleKey, settings: PlayStyleSettings) => void;
}

function selectedStyle(key: PlayStyleKey): (typeof PLAY_STYLES)[number] {
  return PLAY_STYLES.find((style) => style.key === key) ?? PLAY_STYLES[2];
}

function detailsFor(key: PlayStyleKey): PlayStyleDetails {
  if (key === "custom") {
    return {
      assumptions: [
        { kind: "row", key: "baselineEngagement" },
        { kind: "row", key: "teamTrials" },
        { kind: "slider", key: "legendRaces" },
        { kind: "row", key: "rotatingMissions" },
        { kind: "row", key: "specialMissions" },
        { kind: "row", key: "storyEvents" },
        { kind: "row", key: "championsMeeting" },
      ],
    };
  }
  return DETAILS[key];
}

function assumptionRow(row: AssumptionRow, locked: boolean, strings: PlayStyleStrings, playStyleKey: PlayStyleKey): HTMLElement {
  return h(
    "div",
    { class: "playstyle-surface__row" },
    h("span", {
      class: [
        "playstyle-surface__lock",
        !locked && "playstyle-surface__lock--unlocked",
      ].filter(Boolean).join(" "),
      attr: { role: "img", "aria-label": locked ? strings.lockedAssumption : strings.editableAssumption },
    }),
    h("span", { class: "playstyle-surface__label" }, strings.assumptionLabels[row.key]),
    h("span", { class: "playstyle-surface__value" }, strings.presets[playStyleKey].assumptions[row.key]),
  );
}

function sliderRow(row: SliderRow, opts: PlayStyleSurfaceOpts): HTMLElement {
  switch (row.key) {
    case "legendRaces":
      return discreteSlider({
        title: opts.strings.legendRaces.title,
        steps: LEGEND_RACE_KEYS.map((key) => opts.strings.legendRaces.steps[key]),
        selected: legendRaceIndex(opts.settings.legendRaces),
        locked: false,
        onChange: (index) => opts.onSettingsChange({ ...opts.settings, legendRaces: legendRaceKeyAt(index) }),
      });
  }
}

export function playStyleSurface(opts: PlayStyleSurfaceOpts): HTMLElement {
  const style = selectedStyle(opts.playStyleKey);
  const copy = opts.strings.presets[opts.playStyleKey];
  const details = detailsFor(opts.playStyleKey);
  const locked = opts.playStyleKey !== "custom";
  const current = opts.playStyleKey === opts.savedPlayStyleKey && samePlayStyleSettings(opts.settings, opts.savedSettings);
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
        h("span", { class: "playstyle-surface__eyebrow" }, locked ? opts.strings.lockedPreset : opts.strings.customPreset),
        h("h2", { class: "playstyle-surface__title" }, copy.name),
        h("p", { class: "playstyle-surface__archetype" }, copy.archetype),
      ),
    ),
    h("p", { class: "playstyle-surface__shape" }, copy.shape),
    h(
      "div",
      { class: "playstyle-surface__assumptions" },
      ...details.assumptions.map((row) =>
        row.kind === "slider" ? sliderRow(row, opts) : assumptionRow(row, locked, opts.strings, opts.playStyleKey),
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
              if (!current) opts.onApply(opts.playStyleKey, opts.settings);
            },
          },
        },
        opts.strings.apply,
      ),
    ),
  );
}
