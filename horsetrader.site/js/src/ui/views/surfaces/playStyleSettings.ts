import { h } from "../../h.ts";
import { checkbox } from "../widgets/checkbox.ts";
import { discreteSlider } from "../widgets/discreteSlider.ts";
import type { PlayStyleSettings } from "../../../core/playstyle/index.ts";
import type { PlayStyleSettingStrings, PlayStyleStrings } from "../../strings.ts";
import {
  isPlayStyleCheckboxRow,
} from "./playStyleSettingsModel.ts";
import type {
  PlayStyleCheckboxRowDefinition,
  PlayStyleSectionEntry,
  PlayStyleSettingDefinition,
  PlayStyleSettingKey,
} from "./playStyleSettingsModel.ts";

export {
  PLAY_STYLE_SECTIONS,
  playStyleDecisionCount,
  withPlayStyleSetting,
} from "./playStyleSettingsModel.ts";
export type {
  PlayStyleSectionDefinition,
  PlayStyleSettingKey,
} from "./playStyleSettingsModel.ts";

export interface PlayStyleSettingsRenderContext {
  settings: PlayStyleSettings;
  strings: PlayStyleStrings;
  editable: boolean;
  edit: <K extends PlayStyleSettingKey>(key: K, value: PlayStyleSettings[K]) => void;
}

function settingControl<K extends PlayStyleSettingKey>(
  def: PlayStyleSettingDefinition<K>,
  ctx: PlayStyleSettingsRenderContext,
): HTMLElement {
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

function checkboxRow(
  row: PlayStyleCheckboxRowDefinition,
  ctx: PlayStyleSettingsRenderContext,
): HTMLElement {
  return h(
    "div",
    { class: "playstyle-settings__checkbox-row", attr: { style: `--cols: ${row.checkboxes.length}` } },
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

export function playStyleSettingControl(
  entry: PlayStyleSectionEntry,
  ctx: PlayStyleSettingsRenderContext,
): HTMLElement {
  return isPlayStyleCheckboxRow(entry) ? checkboxRow(entry, ctx) : settingControl(entry, ctx);
}
