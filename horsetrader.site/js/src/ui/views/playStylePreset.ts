import "./playStylePreset.css";

import { h } from "../h.ts";
import type { PlayStyleStrings } from "../strings.ts";

export const PLAY_STYLES = [
  { key: "sweetie", icon: "/icons/playstyle-01.png" },
  { key: "casual", icon: "/icons/playstyle-02.png" },
  { key: "focused", icon: "/icons/playstyle-03.png" },
  { key: "dedicated", icon: "/icons/playstyle-04.png" },
  { key: "unhinged", icon: "/icons/playstyle-05.png" },
  { key: "custom", icon: "/icons/playstyle-06.png", locked: true },
] as const;

export type PlayStyleKey = (typeof PLAY_STYLES)[number]["key"];
export const DEFAULT_PLAY_STYLE: PlayStyleKey = "focused";

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
      const locked = "locked" in style && style.locked === true;
      const attr = {
        type: "button",
        "aria-pressed": String(selected),
        "aria-current": active ? "true" : "false",
        "aria-disabled": String(locked),
        title: locked ? opts.strings.customLockedTitle : copy.name,
        "data-play-style": style.key,
      };
      return h(
        "button",
        {
          class: [
            "playstyle-preset",
            active && "playstyle-preset--active",
            selected && "playstyle-preset--selected",
            locked && "playstyle-preset--locked",
          ].filter(Boolean).join(" "),
          attr: locked ? { ...attr, disabled: true } : attr,
          on: {
            click: () => {
              if (!locked) opts.onPreview(style.key);
            },
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
