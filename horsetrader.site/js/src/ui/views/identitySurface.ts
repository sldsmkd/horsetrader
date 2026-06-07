import "./identitySurface.css";

import { h } from "../h.ts";
import { playStylePresetGrid } from "./playStylePreset.ts";
import type { PlayStyleKey } from "./playStylePreset.ts";
import type { PlayStyleStrings } from "../strings.ts";

export interface IdentitySurfaceOpts {
  trainerName: string;
  oshiName: string;
  oshiPortrait: string;
  playStyleKey: PlayStyleKey;
  savedPlayStyleKey: PlayStyleKey;
  playStyleStrings: PlayStyleStrings;
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
  return playStylePresetGrid({
    selectedKey: opts.playStyleKey,
    activeKey: opts.savedPlayStyleKey,
    strings: opts.playStyleStrings,
    onPreview: opts.onPlayStylePreview,
  });
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
