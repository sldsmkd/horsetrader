import "./playStylePreset.css";

import { h } from "../../h.ts";
import { DEFAULT_PLAY_STYLE, PLAY_STYLE_KEYS } from "../../../core/playstyle/index.ts";
import type { PlayStyleKey } from "../../../core/playstyle/index.ts";
import type { PlayStyleStrings } from "../../strings.ts";

// The preset keys are account data (core/playstyle); this module is the DOM grid
// that layers icons on top, in the canonical key order. Custom is core
// functionality (a first-class, always-available preset), NOT a supporter perk —
// see [[project_custom_is_core_not_gated]].
export { DEFAULT_PLAY_STYLE };
export type { PlayStyleKey };

const PLAY_STYLE_ICONS: Record<PlayStyleKey, string> = {
  sweetie: "/icons/playstyle-01.png",
  casual: "/icons/playstyle-02.png",
  focused: "/icons/playstyle-03.png",
  dedicated: "/icons/playstyle-04.png",
  unhinged: "/icons/playstyle-05.png",
  custom: "/icons/playstyle-06.png",
};

export const PLAY_STYLES = PLAY_STYLE_KEYS.map((key) => ({ key, icon: PLAY_STYLE_ICONS[key] }));

export interface PlayStylePresetGridOpts {
  selectedKey: PlayStyleKey;
  activeKey: PlayStyleKey;
  strings: PlayStyleStrings;
  onPreview: (key: PlayStyleKey) => void;
}

export function playStylePresetGrid(opts: PlayStylePresetGridOpts): HTMLElement {
  return h(
    "div",
    { class: "playstyle-presets", attr: { role: "group", "aria-label": opts.strings.title } },
    ...PLAY_STYLES.map((style) => {
      const copy = opts.strings.presets[style.key];
      const active = style.key === opts.activeKey;
      const selected = style.key === opts.selectedKey;
      return h(
        "button",
        {
          class: [
            "playstyle-preset",
            active && "playstyle-preset--active",
            selected && "playstyle-preset--selected",
          ].filter(Boolean).join(" "),
          attr: {
            type: "button",
            "aria-pressed": String(selected),
            "aria-current": active ? "true" : "false",
            title: copy.name,
            "data-play-style": style.key,
          },
          on: {
            click: () => opts.onPreview(style.key),
          },
        },
        h(
          "span",
          { class: "playstyle-preset__icon" },
          h("img", { attr: { src: style.icon, alt: "", width: 64, height: 64 } }),
        ),
        h(
          "span",
          { class: "playstyle-preset__copy" },
          h("span", { class: "playstyle-preset__name" }, copy.name),
          h("span", { class: "playstyle-preset__caption" }, copy.caption),
        ),
      );
    }),
  );
}
