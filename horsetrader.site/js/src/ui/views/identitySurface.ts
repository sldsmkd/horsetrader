import "./identitySurface.css";

import { h } from "../h.ts";

export const PLAY_STYLES = [
  { key: "sweetie", name: "Sweetie", caption: "Love. Ponies. Sunshine.", icon: "/icons/playstyle-01.png" },
  { key: "casual", name: "Casual", caption: "Having fun. Taking it easy.", icon: "/icons/playstyle-02.png" },
  { key: "focused", name: "Focused", caption: "Trying hard. Getting better.", icon: "/icons/playstyle-03.png" },
  { key: "dedicated", name: "Dedicated", caption: "No chill. All gas.", icon: "/icons/playstyle-04.png" },
  { key: "unhinged", name: "Unhinged", caption: "Blood. Sweat. Victory.", icon: "/icons/playstyle-05.png" },
  { key: "custom", name: "Custom", caption: "Make your own legend.", icon: "/icons/playstyle-06.png", locked: true },
];

export type PlayStyleKey = (typeof PLAY_STYLES)[number]["key"];
export const DEFAULT_PLAY_STYLE: PlayStyleKey = "focused";

export interface IdentitySurfaceOpts {
  trainerName: string;
  oshiName: string;
  oshiPortrait: string;
  playStyleKey: PlayStyleKey;
  onTrainerNameChange: (name: string) => void;
  onOshiSelect: () => void;
  onPlayStylePreview: (key: PlayStyleKey) => void;
}

function identityRow(label: string, value: string, detail?: string): HTMLElement {
  return h(
    "div",
    { class: "identity-surface__row" },
    h("span", { class: "identity-surface__label" }, label),
    h(
      "span",
      { class: "identity-surface__value" },
      value,
      detail && h("span", { class: "identity-surface__detail" }, detail),
    ),
  );
}

function editableTrainerName(opts: IdentitySurfaceOpts): HTMLElement {
  const input = h("input", {
    class: "identity-surface__name-input",
    attr: { type: "text", value: opts.trainerName, "aria-label": "Trainer name", maxlength: 24 },
  });
  const commit = (): void => {
    const name = input.value.trim() || "Trainer";
    input.value = name;
    if (name !== opts.trainerName) opts.onTrainerNameChange(name);
  };
  input.addEventListener("change", commit);
  input.addEventListener("blur", commit);

  return h(
    "label",
    { class: "identity-surface__editable" },
    input,
    h(
      "button",
      {
        class: "identity-surface__edit",
        attr: { type: "button", "aria-label": "Edit trainer name", title: "Edit trainer name" },
        on: { click: () => input.focus() },
      },
      "✏️",
    ),
  );
}

function playStyle(opts: IdentitySurfaceOpts): HTMLElement {
  const selectLocal = (button: HTMLButtonElement, key: PlayStyleKey): void => {
    for (const el of button.parentElement?.querySelectorAll<HTMLButtonElement>(".identity-surface__style") ?? []) {
      const selected = el.dataset.playStyle === key;
      el.classList.toggle("identity-surface__style--selected", selected);
      el.setAttribute("aria-pressed", String(selected));
    }
  };

  return h(
    "div",
    { class: "identity-surface__styles", attr: { role: "group", "aria-label": "Play Style" } },
    ...PLAY_STYLES.map((style) => {
      const selected = style.key === opts.playStyleKey;
      const locked = style.locked === true;
      const attr = locked
        ? {
            type: "button",
            "aria-pressed": String(selected),
            disabled: true,
            "aria-disabled": "true",
            title: "Custom play style is locked",
          }
        : { type: "button", "aria-pressed": String(selected), title: style.name };
      return h(
        "button",
        {
          class: [
            "identity-surface__style",
            selected && "identity-surface__style--selected",
            locked && "identity-surface__style--locked",
          ].filter(Boolean).join(" "),
          attr: { ...attr, "data-play-style": style.key },
          on: {
            click: (ev) => {
              if (locked) return;
              selectLocal(ev.currentTarget as HTMLButtonElement, style.key);
              opts.onPlayStylePreview(style.key);
            },
          },
        },
        h(
          "span",
          { class: "identity-surface__style-icon" },
          h("img", { attr: { src: style.icon, alt: "", width: 64, height: 64 } }),
        ),
        h(
          "span",
          { class: "identity-surface__style-copy" },
          h("span", { class: "identity-surface__style-name" }, style.name),
          h("span", { class: "identity-surface__style-caption" }, style.caption),
        ),
      );
    }),
  );
}

export function identitySurface(opts: IdentitySurfaceOpts): HTMLElement {
  return h(
    "section",
    { class: "identity-surface" },
    h(
      "div",
      { class: "identity-surface__card" },
      h(
        "button",
        {
          class: "identity-surface__portrait",
          attr: { type: "button", "aria-label": "Choose oshi", title: "Choose oshi" },
          on: { click: opts.onOshiSelect },
        },
        h("img", { attr: { src: opts.oshiPortrait, alt: "", width: 256, height: 512 } }),
        h("span", { class: "identity-surface__portrait-edit", attr: { "aria-hidden": "true" } }, "✏️"),
      ),
      h(
        "div",
        { class: "identity-surface__details" },
        h(
          "div",
          { class: "identity-surface__title" },
          editableTrainerName(opts),
        ),
        h(
          "div",
          { class: "identity-surface__section" },
          identityRow("ID (Optional)", "???-???-???-???"),
          identityRow("Club", "UmaDen", "B+"),
          identityRow("Oshi", opts.oshiName),
        ),
      ),
    ),
    h(
      "div",
      { class: "identity-surface__playstyle" },
      h("span", { class: "identity-surface__label" }, "Play Style"),
      playStyle(opts),
    ),
  );
}
