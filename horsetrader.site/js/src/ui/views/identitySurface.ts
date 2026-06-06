import "./identitySurface.css";

import { h } from "../h.ts";

const REPRESENTATIVE_UMA = {
  name: "Admire Groove",
  icon: "/img/characters/admire-groove_icon.webp",
};

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

function playStyle(): HTMLElement {
  const styles = ["Very Chill", "Casual", "Competitive", "Custom"];
  return h(
    "div",
    { class: "identity-surface__styles", attr: { role: "group", "aria-label": "Play Style" } },
    ...styles.map((style) =>
      h(
        "button",
        {
          class: `identity-surface__style${style === "Competitive" ? " identity-surface__style--selected" : ""}`,
          attr: { type: "button", "aria-pressed": String(style === "Competitive") },
        },
        style,
      ),
    ),
  );
}

export function identitySurface(): HTMLElement {
  return h(
    "section",
    { class: "identity-surface" },
    h(
      "div",
      { class: "identity-surface__hero" },
      h(
        "button",
        {
          class: "identity-surface__avatar identity-surface__avatar--selected",
          attr: { type: "button", "aria-label": `Representative Uma: ${REPRESENTATIVE_UMA.name}` },
        },
        h("img", { attr: { src: REPRESENTATIVE_UMA.icon, alt: "", width: 96, height: 96 } }),
      ),
      h(
        "div",
        { class: "identity-surface__intro" },
        h("span", { class: "identity-surface__eyebrow" }, "Stable"),
        h("strong", { class: "identity-surface__name" }, "UmaDen"),
        h("span", { class: "identity-surface__meta" }, "B+ club"),
      ),
    ),
    h(
      "div",
      { class: "identity-surface__section" },
      identityRow("Representative Uma", REPRESENTATIVE_UMA.name),
      identityRow("Club", "UmaDen", "B+"),
      identityRow("Trainer ID", "765........."),
    ),
    h(
      "div",
      { class: "identity-surface__section" },
      h("span", { class: "identity-surface__label" }, "Play Style"),
      playStyle(),
    ),
  );
}
