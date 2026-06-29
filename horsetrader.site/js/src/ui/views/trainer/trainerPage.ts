import "./trainerPage.css";

import { h } from "../../h.ts";
import { normaliseName, TRAINER_NAME_MAX } from "../../../core/persistence/validate.ts";
import {
  playStyleSettingsForPreset,
  samePlayStyleSettings,
} from "../../../core/playstyle/index.ts";
import type { PlayStyleKey, PlayStyleSettings } from "../../../core/playstyle/index.ts";
import type { ClubIdentity } from "../../../core/identity/clubrank.ts";
import type { PlayStyleStrings } from "../../strings.ts";
import { formatCharacterName } from "../../format.ts";
import { clubRankIcon } from "../surfaces/clubSelector.ts";
import { PLAY_STYLES, playStylePresetGrid } from "../surfaces/playStylePreset.ts";
import {
  PLAY_STYLE_SECTIONS,
  playStyleSettingControl,
  withPlayStyleSetting,
} from "../surfaces/playStyleSettings.ts";
import type {
  PlayStyleSettingKey,
  PlayStyleSettingsRenderContext,
} from "../surfaces/playStyleSettings.ts";

export interface TrainerPageOpts {
  trainerName: string;
  oshiName: string;
  oshiPortrait: string;
  club: ClubIdentity | null;
  savedPlayStyleKey: PlayStyleKey;
  savedPlayStyleSettings: PlayStyleSettings;
  playStyleStrings: PlayStyleStrings;
  cloud?: Node | undefined;
  onTrainerNameChange: (name: string) => void;
  onOshiSelect: () => void;
  onClubSelect: () => void;
  onSettingsChange?: ((settings: PlayStyleSettings) => void) | undefined;
  onApply: (key: PlayStyleKey, settings: PlayStyleSettings) => void;
  onClose?: (() => void) | undefined;
}

function styleFor(key: PlayStyleKey): (typeof PLAY_STYLES)[number] {
  return PLAY_STYLES.find((style) => style.key === key) ?? PLAY_STYLES[2];
}

function trainerNameInput(opts: TrainerPageOpts): HTMLInputElement {
  const input = h("input", {
    class: "mobile-trainer__name ht-type-headline-text ht-type-edit-control",
    attr: {
      type: "text",
      value: opts.trainerName,
      "aria-label": "Trainer name",
    },
  });
  input.addEventListener("input", () => {
    const clean = normaliseName(input.value, TRAINER_NAME_MAX);
    if (clean !== input.value) {
      input.value = clean;
      input.setSelectionRange(clean.length, clean.length);
    }
  });
  const commit = (): void => {
    const name = normaliseName(input.value, TRAINER_NAME_MAX).trim() || "Trainer";
    input.value = name;
    if (name !== opts.trainerName) opts.onTrainerNameChange(name);
  };
  input.addEventListener("change", commit);
  input.addEventListener("blur", () => {
    commit();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
  });
  return input;
}

function clubButton(opts: TrainerPageOpts): HTMLButtonElement {
  const club = opts.club;
  return h(
    "button",
    {
      class: "mobile-trainer__club",
      attr: {
        type: "button",
        "aria-label": club ? "Edit club" : "Join a club",
      },
      on: { click: opts.onClubSelect },
    },
    h("span", { class: "mobile-trainer__field-label" }, "Club"),
    h(
      "span",
      { class: "mobile-trainer__club-value" },
      club?.name ?? "No club",
      club
        ? h("img", {
            attr: { src: clubRankIcon(club.rank), alt: club.rank, width: 28, height: 31 },
          })
        : null,
    ),
  );
}

/**
 * Unified Trainer page. Its composition is invariant; Godolphin presentation policy makes
 * the containing layer a floating glass window on desktop/tablet or a full-viewport page on
 * a touch phone. Play-style staging stays local to this one scrolling document.
 */
export function trainerPage(opts: TrainerPageOpts): HTMLElement {
  let selectedKey = opts.savedPlayStyleKey;
  let liveSettings = { ...opts.savedPlayStyleSettings };

  const page = h("section", { class: "mobile-trainer", attr: { "aria-label": "Trainer" } });
  const detail = h("div", { class: "mobile-trainer__playstyle-detail" });
  let presetHost: HTMLElement;
  let applyButton: HTMLButtonElement;
  let discardButton: HTMLButtonElement;

  const nothingToApply = (): boolean =>
    samePlayStyleSettings(liveSettings, opts.savedPlayStyleSettings) &&
    (selectedKey === opts.savedPlayStyleKey || selectedKey === "custom");

  const syncActions = (): void => {
    const clean = nothingToApply();
    applyButton.disabled = clean;
    applyButton.setAttribute("aria-disabled", String(clean));
    discardButton.disabled =
      selectedKey === opts.savedPlayStyleKey &&
      samePlayStyleSettings(liveSettings, opts.savedPlayStyleSettings);
  };

  const edit = <K extends PlayStyleSettingKey>(key: K, value: PlayStyleSettings[K]): void => {
    liveSettings = withPlayStyleSetting(liveSettings, key, value);
    opts.onSettingsChange?.(liveSettings);
    syncActions();
  };

  const renderDetail = (): void => {
    const style = styleFor(selectedKey);
    const copy = opts.playStyleStrings.presets[selectedKey];
    const editable = selectedKey === "custom";
    const ctx: PlayStyleSettingsRenderContext = {
      settings: liveSettings,
      strings: opts.playStyleStrings,
      editable,
      edit,
    };
    detail.replaceChildren(
      h(
        "div",
        { class: "mobile-trainer__style-mast" },
        h("img", { attr: { src: style.icon, alt: "", width: 64, height: 64 } }),
        h(
          "div",
          {},
          h("h2", { class: "mobile-trainer__style-title" }, copy.name),
          h("p", { class: "mobile-trainer__style-caption" }, copy.caption),
        ),
      ),
      h("p", { class: "mobile-trainer__style-shape" }, copy.shape),
      h(
        "p",
        { class: "mobile-trainer__style-note" },
        editable
          ? "Custom is yours to tune. Every setting is expanded below."
          : "Preset values are read-only. Every assumption is shown below.",
      ),
      ...PLAY_STYLE_SECTIONS.map((section) =>
        h(
          "section",
          { class: "mobile-trainer__settings-section" },
          h("h3", { class: "mobile-trainer__settings-title" }, section.title),
          h("p", { class: "mobile-trainer__settings-description" }, section.description),
          h(
            "div",
            { class: "mobile-trainer__settings-controls" },
            ...section.entries.map((entry) => playStyleSettingControl(entry, ctx)),
          ),
        ),
      ),
    );
    syncActions();
  };

  const selectStyle = (key: PlayStyleKey): void => {
    selectedKey = key === selectedKey ? opts.savedPlayStyleKey : key;
    liveSettings =
      selectedKey === "custom" || selectedKey === opts.savedPlayStyleKey
        ? { ...opts.savedPlayStyleSettings }
        : { ...playStyleSettingsForPreset(selectedKey) };
    const nextGrid = playStylePresetGrid({
      selectedKey,
      activeKey: opts.savedPlayStyleKey,
      strings: opts.playStyleStrings,
      onPreview: selectStyle,
    });
    presetHost.replaceChildren(...Array.from(nextGrid.childNodes));
    renderDetail();
  };

  presetHost = playStylePresetGrid({
    selectedKey,
    activeKey: opts.savedPlayStyleKey,
    strings: opts.playStyleStrings,
    onPreview: selectStyle,
  });

  discardButton = h(
    "button",
    {
      class: "mobile-trainer__action mobile-trainer__action--quiet",
      attr: { type: "button" },
      on: { click: () => selectStyle(opts.savedPlayStyleKey) },
    },
    "Discard",
  );
  applyButton = h(
    "button",
    {
      class: "mobile-trainer__action mobile-trainer__action--apply",
      attr: { type: "button" },
      on: {
        click: () => {
          if (!nothingToApply()) opts.onApply(selectedKey, liveSettings);
        },
      },
    },
    opts.playStyleStrings.apply,
  );

  page.append(
    h(
      "header",
      { class: "mobile-trainer__header" },
      opts.onClose
        ? h(
            "button",
            {
              class: "mobile-trainer__back",
              attr: { type: "button", "aria-label": "Back to timeline" },
              on: { click: opts.onClose },
            },
            "‹",
          )
        : null,
      h(
        "label",
        { class: "mobile-trainer__header-name" },
        trainerNameInput(opts),
      ),
    ),
    h(
      "div",
      { class: "mobile-trainer__body" },
      h(
        "section",
        { class: "mobile-trainer__identity" },
        h(
          "button",
          {
            class: "mobile-trainer__portrait",
            attr: { type: "button", "aria-label": "Choose oshi" },
            on: { click: opts.onOshiSelect },
          },
          h("img", { attr: { src: opts.oshiPortrait, alt: "", width: 256, height: 512 } }),
          h("span", { class: "mobile-trainer__oshi-name" }, formatCharacterName(opts.oshiName)),
          h("span", { class: "mobile-trainer__portrait-edit", attr: { "aria-hidden": "true" } }, "✏️"),
        ),
        h(
          "div",
          { class: "mobile-trainer__identity-fields" },
          clubButton(opts),
          opts.cloud
            ? h(
                "div",
                { class: "mobile-trainer__cloud" },
                h("span", { class: "mobile-trainer__field-label" }, "Cloud Save"),
                opts.cloud,
              )
            : null,
        ),
      ),
      h(
        "section",
        { class: "mobile-trainer__playstyle" },
        h("h2", { class: "mobile-trainer__section-title" }, opts.playStyleStrings.title),
        presetHost,
        detail,
      ),
    ),
    h(
      "footer",
      { class: "mobile-trainer__actions" },
      discardButton,
      applyButton,
    ),
  );

  renderDetail();
  return page;
}
