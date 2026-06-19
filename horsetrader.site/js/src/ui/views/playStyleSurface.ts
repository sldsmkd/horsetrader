import "./playStyleSurface.css";

import { h } from "../h.ts";
import { checkbox } from "./checkbox.ts";
import { collapsePill } from "./collapsePill.ts";
import { surfaceActions } from "./surfaceActions.ts";
import { discreteSlider } from "./discreteSlider.ts";
import { PLAY_STYLES } from "./playStylePreset.ts";
import type { PlayStyleKey } from "./playStylePreset.ts";
import {
  CHAMPIONS_MEETING_KEYS,
  LEAGUE_OF_HEROES_KEYS,
  MASTERS_KEYS,
  SHOP_TICKET_KEYS,
  STORY_KEYS,
  STRONGEST_TEAM_KEYS,
  TEAM_TRIAL_KEYS,
  samePlayStyleSettings,
} from "../../core/playstyle/index.ts";
import type { PlayStyleSettings, PlayToggleKey } from "../../core/playstyle/index.ts";
import type { PlayStyleSettingStrings, PlayStyleStrings } from "../strings.ts";

type SettingKey = keyof PlayStyleSettings;

// The settings whose value is exactly a binary on/off — the only ones a checkbox
// row can render (a graded ladder like Team Trials would silently read as "off").
type ToggleSettingKey = {
  [K in SettingKey]: PlayStyleSettings[K] extends PlayToggleKey
    ? PlayToggleKey extends PlayStyleSettings[K]
      ? K
      : never
    : never;
}[SettingKey];

interface SettingDefinition<K extends SettingKey = SettingKey> {
  key: K;
  keys: readonly PlayStyleSettings[K][];
}

/** A compact row of passive binary gates — several checkboxes share one row. */
interface CheckboxRowDefinition {
  checkboxes: readonly ToggleSettingKey[];
}

type DrawerEntry = SettingDefinition | CheckboxRowDefinition;

function isCheckboxRow(entry: DrawerEntry): entry is CheckboxRowDefinition {
  return "checkboxes" in entry;
}

interface DrawerDefinition {
  title: string;
  description: string;
  entries: readonly DrawerEntry[];
}

/** Each slider control is one decision; a checkbox row is one per box. */
function decisionCount(drawer: DrawerDefinition): number {
  return drawer.entries.reduce((n, e) => n + (isCheckboxRow(e) ? e.checkboxes.length : 1), 0);
}

/**
 * What the drawer renderers need. `editable` is true only for Custom (presets
 * render locked; supporter-gating keeps Custom otherwise off-limits). `edit`
 * applies one key change — the control updates its own visual in place, this
 * just records + persists the new value, so no surrounding re-render fires.
 */
interface DrawerRenderCtx {
  settings: PlayStyleSettings;
  strings: PlayStyleStrings;
  editable: boolean;
  edit: <K extends SettingKey>(key: K, value: PlayStyleSettings[K]) => void;
}

/** A typed single-key update — the computed-key spread keeps `PlayStyleSettings`. */
function withSetting<K extends SettingKey>(
  settings: PlayStyleSettings,
  key: K,
  value: PlayStyleSettings[K],
): PlayStyleSettings {
  return { ...settings, [key]: value };
}

const DRAWERS: readonly DrawerDefinition[] = [
  {
    title: "PARTICIPATE",
    description: "Regular loops, story beats, and shop participation.",
    entries: [
      // The passive login/account gates — too low-stakes for a slider each.
      { checkboxes: ["dailies", "weeklyLogin", "traineeDebuts"] },
      // "Show up and collect" event gates — also binary participation.
      { checkboxes: ["holidays", "anniversaryMissions", "scenarioMissions"] },
      { key: "teamTrials", keys: TEAM_TRIAL_KEYS },
      { key: "storyEvents", keys: STORY_KEYS },
      { key: "shopTickets", keys: SHOP_TICKET_KEYS },
    ],
  },
  {
    title: "ENGAGE",
    description: "Structured event modes and residual mission chores.",
    entries: [
      // All four are binary opt-in gates — two rows of two.
      { checkboxes: ["factorStudies", "racingCarnival"] },
      { checkboxes: ["showtime", "missions"] },
    ],
  },
  {
    title: "CHALLENGE",
    description: "Harder structured PvE with real clear gates.",
    entries: [
      // Two binary clear gates share a row; Masters is the graded clear-level slider.
      { checkboxes: ["legendRaces", "skillTests"] },
      { key: "masters", keys: MASTERS_KEYS },
    ],
  },
  {
    title: "COMPETE",
    description: "Expected PvP and roster-event outcomes.",
    entries: [
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
  onDismiss: () => void;
}

function selectedStyle(key: PlayStyleKey): (typeof PLAY_STYLES)[number] {
  return PLAY_STYLES.find((style) => style.key === key) ?? PLAY_STYLES[2];
}

function settingControl<K extends SettingKey>(def: SettingDefinition<K>, ctx: DrawerRenderCtx): HTMLElement {
  const copy = ctx.strings.settings[def.key] as PlayStyleSettingStrings<PlayStyleSettings[K] & string>;
  const selectedKey = ctx.settings[def.key];
  const selected = def.keys.indexOf(selectedKey);
  const steps = def.keys.map((key) => copy.steps[key as PlayStyleSettings[K] & string]);
  return discreteSlider({
    title: copy.title,
    steps,
    selected: selected === -1 ? 0 : selected,
    locked: !ctx.editable,
    ...(ctx.editable ? { onChange: (idx: number) => ctx.edit(def.key, def.keys[idx]!) } : {}),
  });
}

function checkboxRow(row: CheckboxRowDefinition, ctx: DrawerRenderCtx): HTMLElement {
  return h(
    "div",
    { class: "playstyle-surface__checkbox-row", attr: { style: `--cols: ${row.checkboxes.length}` } },
    ...row.checkboxes.map((key) =>
      checkbox({
        title: ctx.strings.settings[key].title,
        checked: ctx.settings[key] === "on",
        locked: !ctx.editable,
        onToggle: (checked) => ctx.edit(key, checked ? "on" : "off"),
      }),
    ),
  );
}

function entryControl(entry: DrawerEntry, ctx: DrawerRenderCtx): HTMLElement {
  return isCheckboxRow(entry) ? checkboxRow(entry, ctx) : settingControl(entry, ctx);
}

// Which drawers are expanded, keyed by title. Module-scoped so the open set
// survives the real re-renders (commit, opening a modal, switching preset) — the
// per-render DOM `aria-expanded` would otherwise reset to closed.
const openDrawers = new Set<string>();

// The drawer list's scroll offset, persisted across those same re-renders so the
// list doesn't jump back to the top.
let drawersScrollTop = 0;

function drawerFor(drawer: DrawerDefinition, ctx: DrawerRenderCtx): HTMLElement {
  let panel: HTMLElement;
  let button: HTMLButtonElement;
  const startOpen = openDrawers.has(drawer.title);
  const setOpen = (open: boolean): void => {
    button.setAttribute("aria-expanded", String(open));
    button.classList.toggle("playstyle-surface__drawer-toggle--open", open);
    if (open) openDrawers.add(drawer.title);
    else openDrawers.delete(drawer.title);
  };
  const toggleOpen = (): void => setOpen(button.getAttribute("aria-expanded") !== "true");

  button = h(
    "button",
    {
      class: ["playstyle-surface__drawer-toggle", startOpen && "playstyle-surface__drawer-toggle--open"]
        .filter(Boolean)
        .join(" "),
      attr: { type: "button", "aria-expanded": String(startOpen) },
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
    h("span", { class: "playstyle-surface__drawer-note" }, `${decisionCount(drawer)} decisions`),
  );

  panel = h(
    "div",
    { class: "playstyle-surface__drawer-body" },
    ...drawer.entries.map((entry) => entryControl(entry, ctx)),
  );
  return h("section", { class: "playstyle-surface__drawer" }, button, panel);
}

export function playStyleSurface(opts: PlayStyleSurfaceOpts): HTMLElement {
  const style = selectedStyle(opts.playStyleKey);
  const copy = opts.strings.presets[opts.playStyleKey];

  // The live, in-place-edited settings. Custom edits mutate this and update their
  // own control + the Apply button below — no surrounding re-render — then persist
  // silently (onSettingsChange) so the next real render still sees the staged set.
  let live: PlayStyleSettings = { ...opts.settings };
  const editable = opts.playStyleKey === "custom";

  // Nothing to apply when the live settings already match what's saved AND either
  // you're on your saved style or on Custom — switching the *label* to Custom with
  // identical settings changes nothing about the plan (income is the settings, not
  // the label; you commit Custom by actually tweaking something). A different
  // *preset* always carries different settings, so it stays enabled.
  const nothingToApply = (): boolean =>
    samePlayStyleSettings(live, opts.savedSettings) &&
    (opts.playStyleKey === opts.savedPlayStyleKey || opts.playStyleKey === "custom");

  let applyButton: HTMLButtonElement;
  const syncApply = (): void => {
    const off = nothingToApply();
    applyButton.disabled = off;
    applyButton.classList.toggle("playstyle-surface__apply--disabled", off);
    applyButton.setAttribute("aria-disabled", String(off));
  };
  const edit = <K extends SettingKey>(key: K, value: PlayStyleSettings[K]): void => {
    live = withSetting(live, key, value);
    syncApply();
    opts.onSettingsChange(live);
  };

  const ctx: DrawerRenderCtx = { settings: live, strings: opts.strings, editable, edit };

  const drawers = h(
    "div",
    {
      class: "playstyle-surface__drawers",
      on: { scroll: () => (drawersScrollTop = drawers.scrollTop) },
    },
    ...DRAWERS.map((drawer) => drawerFor(drawer, ctx)),
  );
  // Restore the offset after this rebuilt list is mounted AND laid out. Double
  // rAF on purpose: the overlay locks the card's height in its own first-frame
  // rAF, so a single rAF here would run before that and clamp scrollTop to ~0
  // (container not yet full height). The second frame runs after the height lock.
  requestAnimationFrame(() => requestAnimationFrame(() => (drawers.scrollTop = drawersScrollTop)));

  applyButton = h(
    "button",
    {
      class: "playstyle-surface__apply",
      attr: { type: "button" },
      on: {
        click: () => {
          if (!nothingToApply()) opts.onApply(opts.playStyleKey, live);
        },
      },
    },
    opts.strings.apply,
  );
  syncApply(); // initial enabled/disabled state

  // Directional collapse affordance: chevrons point left, back toward the trainer
  // card this surface folds into.
  const collapse = collapsePill({
    direction: "left",
    float: true,
    label: "Collapse back to trainer card",
    onClick: opts.onDismiss,
  });

  return h(
    "section",
    { class: "playstyle-surface" },
    collapse,
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
        ? "Custom is yours to tune — open a drawer and adjust any control, then Apply. It stays open so you can keep tweaking."
        : "Preset values are read-only. Open a drawer to see exactly what this preset counts.",
    ),
    drawers,
    surfaceActions(applyButton),
  );
}
