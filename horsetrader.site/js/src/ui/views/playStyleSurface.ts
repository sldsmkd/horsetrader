import "./playStyleSurface.css";

import { h } from "../h.ts";
import { PLAY_STYLES } from "./playStylePreset.ts";
import type { PlayStyleKey } from "./playStylePreset.ts";
import { samePlayStyleSettings } from "../../core/playstyle/index.ts";
import type { PlayStyleSettings } from "../../core/playstyle/index.ts";
import type { PlayStyleStrings } from "../strings.ts";

const GROUP_DRAWERS = ["PARTICIPATE", "ENGAGE", "CHALLENGE", "COMPETE"] as const;

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
      { class: "playstyle-surface__drawers" },
      ...GROUP_DRAWERS.map((name) =>
        h(
          "div",
          { class: "playstyle-surface__drawer" },
          h("span", { class: "playstyle-surface__drawer-title" }, name),
          h("span", { class: "playstyle-surface__drawer-note" }, "Advanced settings placeholder"),
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
              if (!current) opts.onApply(opts.playStyleKey, opts.settings);
            },
          },
        },
        opts.strings.apply,
      ),
    ),
  );
}
