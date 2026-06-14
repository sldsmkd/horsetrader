import "./playStyleSurface.css";

import { h } from "../h.ts";
import { discreteSlider } from "./discreteSlider.ts";
import { PLAY_STYLES } from "./playStylePreset.ts";
import type { PlayStyleKey } from "./playStylePreset.ts";
import {
  CHAMPIONS_MEETING_KEYS,
  LEAGUE_OF_HEROES_KEYS,
  MASTERS_KEYS,
  MISSION_KEYS,
  PLAY_TOGGLE_KEYS,
  SHOP_TICKET_KEYS,
  STRONGEST_TEAM_KEYS,
  TEAM_TRIAL_KEYS,
  samePlayStyleSettings,
} from "../../core/playstyle/index.ts";
import type { PlayStyleSettings } from "../../core/playstyle/index.ts";
import type { PlayStyleSettingStrings, PlayStyleStrings } from "../strings.ts";

type SettingKey = keyof PlayStyleSettings;

interface SettingDefinition<K extends SettingKey = SettingKey> {
  key: K;
  keys: readonly PlayStyleSettings[K][];
}

interface DrawerDefinition {
  title: string;
  description: string;
  settings: readonly SettingDefinition[];
}

const DRAWERS: readonly DrawerDefinition[] = [
  {
    title: "PARTICIPATE",
    description: "Regular loops, story beats, and shop participation.",
    settings: [
      { key: "dailies", keys: PLAY_TOGGLE_KEYS },
      { key: "weeklyLogin", keys: PLAY_TOGGLE_KEYS },
      { key: "teamTrials", keys: TEAM_TRIAL_KEYS },
      { key: "anniversaryMissions", keys: PLAY_TOGGLE_KEYS },
      { key: "holidays", keys: PLAY_TOGGLE_KEYS },
      { key: "scenarioMissions", keys: PLAY_TOGGLE_KEYS },
      { key: "traineeDebuts", keys: PLAY_TOGGLE_KEYS },
      { key: "storyEvents", keys: PLAY_TOGGLE_KEYS },
      { key: "shopTickets", keys: SHOP_TICKET_KEYS },
    ],
  },
  {
    title: "ENGAGE",
    description: "Limited-event gates for the extra mission/card chores.",
    settings: [
      { key: "factorStudies", keys: PLAY_TOGGLE_KEYS },
      { key: "racingCarnival", keys: PLAY_TOGGLE_KEYS },
      { key: "showtime", keys: PLAY_TOGGLE_KEYS },
      { key: "missions", keys: MISSION_KEYS },
    ],
  },
  {
    title: "CHALLENGE",
    description: "PvE clear gates and expected challenge level.",
    settings: [
      { key: "legendRaces", keys: PLAY_TOGGLE_KEYS },
      { key: "skillTests", keys: PLAY_TOGGLE_KEYS },
      { key: "masters", keys: MASTERS_KEYS },
    ],
  },
  {
    title: "COMPETE",
    description: "Expected PvP and roster-event outcomes.",
    settings: [
      { key: "championsMeeting", keys: CHAMPIONS_MEETING_KEYS },
      { key: "leagueOfHeroes", keys: LEAGUE_OF_HEROES_KEYS },
      { key: "strongestTeam", keys: STRONGEST_TEAM_KEYS },
    ],
  },
] as const;

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

function settingControl<K extends SettingKey>(
  def: SettingDefinition<K>,
  opts: Pick<PlayStyleSurfaceOpts, "settings" | "strings">,
): HTMLElement {
  const copy = opts.strings.settings[def.key] as PlayStyleSettingStrings<PlayStyleSettings[K] & string>;
  const selectedKey = opts.settings[def.key];
  const selected = def.keys.indexOf(selectedKey);
  const steps = def.keys.map((key) => copy.steps[key as PlayStyleSettings[K] & string]);
  return discreteSlider({
    title: copy.title,
    steps,
    selected: selected === -1 ? 0 : selected,
    locked: true,
  });
}

function drawerFor(drawer: DrawerDefinition, opts: PlayStyleSurfaceOpts): HTMLElement {
  let panel: HTMLElement;
  let button: HTMLButtonElement;
  const setOpen = (open: boolean): void => {
    button.setAttribute("aria-expanded", String(open));
    button.classList.toggle("playstyle-surface__drawer-toggle--open", open);
  };
  const toggleOpen = (): void => setOpen(button.getAttribute("aria-expanded") !== "true");

  button = h(
    "button",
    {
      class: "playstyle-surface__drawer-toggle",
      attr: { type: "button", "aria-expanded": "false" },
      on: {
        click: toggleOpen,
      },
    },
    h(
      "span",
      { class: "playstyle-surface__drawer-heading" },
      h("span", { class: "playstyle-surface__drawer-title" }, drawer.title),
      h("span", { class: "playstyle-surface__drawer-description" }, drawer.description),
    ),
    h("span", { class: "playstyle-surface__drawer-note" }, `${drawer.settings.length} decisions`),
  );

  panel = h(
    "div",
    { class: "playstyle-surface__drawer-body" },
    ...drawer.settings.map((setting) => settingControl(setting, opts)),
  );
  return h("section", { class: "playstyle-surface__drawer" }, button, panel);
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
      "p",
      { class: "playstyle-surface__lock-note" },
      opts.playStyleKey === "custom"
        ? "Custom currently mirrors Unhinged. These controls show the inherited state until custom editing lands."
        : "Preset values are read-only for now. Open a drawer to see exactly what this preset counts.",
    ),
    h(
      "div",
      { class: "playstyle-surface__drawers" },
      ...DRAWERS.map((drawer) => drawerFor(drawer, opts)),
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
