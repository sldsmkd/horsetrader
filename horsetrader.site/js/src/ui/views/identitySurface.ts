import "./identitySurface.css";

import { h } from "../h.ts";

const REPRESENTATIVE_UMA = {
  name: "Admire Groove",
  icon: "/img/characters/admire-groove_icon.webp",
  portrait: "/img/characters/admire-groove_portrait.webp",
};

const PLAY_STYLES = [
  { name: "Sweetie", caption: "Love. Ponies. Sunshine.", icon: "/icons/playstyle-01.png" },
  { name: "Casual", caption: "Having fun. Taking it easy.", icon: "/icons/playstyle-02.png" },
  { name: "Focused", caption: "Trying hard. Getting better.", icon: "/icons/playstyle-03.png" },
  { name: "Dedicated", caption: "No chill. All gas.", icon: "/icons/playstyle-04.png" },
  { name: "Unhinged", caption: "Blood. Sweat. Victory.", icon: "/icons/playstyle-05.png" },
  { name: "Custom", caption: "Make your own legend.", icon: "/icons/playstyle-06.png" },
];

export interface IdentitySurfaceOpts {
  trainerName: string;
  onTrainerNameChange: (name: string) => void;
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

function playStyle(): HTMLElement {
  return h(
    "div",
    { class: "identity-surface__styles", attr: { role: "group", "aria-label": "Play Style" } },
    ...PLAY_STYLES.map((style) =>
      h(
        "button",
        {
          class: `identity-surface__style${style.name === "Focused" ? " identity-surface__style--selected" : ""}`,
          attr: { type: "button", "aria-pressed": String(style.name === "Focused") },
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
      ),
    ),
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
        "div",
        { class: "identity-surface__portrait" },
        h("img", { attr: { src: REPRESENTATIVE_UMA.portrait, alt: "", width: 256, height: 512 } }),
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
          identityRow("Oshi", REPRESENTATIVE_UMA.name),
        ),
      ),
    ),
    h(
      "div",
      { class: "identity-surface__playstyle" },
      h("span", { class: "identity-surface__label" }, "Play Style"),
      playStyle(),
    ),
  );
}
