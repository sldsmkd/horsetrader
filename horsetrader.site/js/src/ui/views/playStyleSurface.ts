import "./playStyleSurface.css";

import { h } from "../h.ts";
import { discreteSlider } from "./discreteSlider.ts";
import { PLAY_STYLES } from "./playStylePreset.ts";
import type { PlayStyleKey } from "./playStylePreset.ts";
import {
  CHAMPIONS_MEETING_KEYS,
  MISSION_KEYS,
  SHOP_TICKET_KEYS,
  SPECIAL_MISSION_KEYS,
  STORY_EVENT_KEYS,
  TEAM_TRIAL_KEYS,
  WEEKLY_PLAY_KEYS,
  samePlayStyleSettings,
} from "../../core/playstyle/index.ts";
import type { PlayStyleSettings } from "../../core/playstyle/index.ts";
import type { PlayStyleStrings } from "../strings.ts";

type SliderKey = keyof PlayStyleSettings;

const SLIDER_ROWS: readonly SliderKey[] = [
  "weeklyPlay",
  "teamTrials",
  "missions",
  "specialMissions",
  "storyEvents",
  "championsMeeting",
  "shopTickets",
];

const SLIDER_KEYS = {
  weeklyPlay: WEEKLY_PLAY_KEYS,
  teamTrials: TEAM_TRIAL_KEYS,
  missions: MISSION_KEYS,
  specialMissions: SPECIAL_MISSION_KEYS,
  storyEvents: STORY_EVENT_KEYS,
  championsMeeting: CHAMPIONS_MEETING_KEYS,
  shopTickets: SHOP_TICKET_KEYS,
} as const;

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

function sliderRow(key: SliderKey, opts: PlayStyleSurfaceOpts): HTMLElement {
  const keys = SLIDER_KEYS[key] as readonly string[];
  const setting = opts.strings.settings[key] as {
    title: string;
    steps: Record<string, { value: string; description: string }>;
  };
  const selected = keys.indexOf(String(opts.settings[key]));
  const locked = opts.playStyleKey !== "custom";
  // Guard the keys↔strings contract. `SLIDER_KEYS[key]` (the playstyle enum) and
  // `strings.settings[key].steps` are two hand-maintained lists that MUST stay in
  // lockstep; whenever they drift — e.g. you change a `*_KEYS` set in
  // core/playstyle/settings.ts but miss the matching block in ui/strings.ts — this
  // map would otherwise emit `undefined` step objects and discreteSlider would throw
  // reading `.value`, white-screening the entire trainee/play-style surface (looks
  // like "the pipeline broke"). Coalesce to a visible placeholder + warn instead, so
  // a mismatch degrades to an obvious bad label you can fix, not a crash. Future me:
  // if you see "fix me: <key>" steps, the strings block is out of sync with the enum.
  const steps = keys.map((stepKey) => {
    const step = setting.steps[stepKey];
    if (step) return step;
    console.warn(`playStyleSurface: no strings for ${key}.${stepKey} — keys/strings drift`);
    return { value: stepKey, description: `fix me: ${key}.${stepKey}` };
  });
  return discreteSlider({
    title: setting.title,
    steps,
    selected,
    locked,
    onChange: (index) => {
      const nextKey = keys[index] ?? keys[0];
      opts.onSettingsChange({ ...opts.settings, [key]: nextKey } as PlayStyleSettings);
    },
  });
}

export function playStyleSurface(opts: PlayStyleSurfaceOpts): HTMLElement {
  const style = selectedStyle(opts.playStyleKey);
  const copy = opts.strings.presets[opts.playStyleKey];
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
        h("h2", { class: "playstyle-surface__title" }, copy.name),
        h("p", { class: "playstyle-surface__motto" }, copy.caption),
      ),
    ),
    h("p", { class: "playstyle-surface__shape" }, copy.shape),
    h(
      "div",
      { class: "playstyle-surface__sliders" },
      h(
        "div",
        { class: "playstyle-surface__assumptions" },
        ...SLIDER_ROWS.map((row) => sliderRow(row, opts)),
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
