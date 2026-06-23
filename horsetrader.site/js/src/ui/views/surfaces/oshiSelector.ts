import "./oshiSelector.css";

import { DEFAULT_OSHI_ID, searchOshis, starterOshis } from "../../query/index.ts";
import type { OshiCostumeIndex, OshiOption, OshiSearchIndex } from "../../query/index.ts";
import { h } from "../../h.ts";
import { pressedGroup } from "../widgets/pressedGroup.ts";
import { surfaceActions } from "./surfaceActions.ts";
import { surfaceCancel } from "./surface.ts";

export interface OshiSelectorOpts {
  selectedId?: string;
  selected: OshiOption;
  search: OshiSearchIndex;
  costumes: OshiCostumeIndex;
  onCommit: (oshi: OshiOption) => void;
  onClose: () => void;
}

export function oshiSelector(opts: OshiSelectorOpts): HTMLElement {
  const initialId = opts.selectedId ?? DEFAULT_OSHI_ID;
  let selectedId = initialId;
  let selectedOshi = opts.selected;
  let selectedCharacterId = selectedOshi.characterId;
  const characterButtons = new Map<string, HTMLButtonElement>();
  const costumeButtons = new Map<string, HTMLButtonElement>();
  const grid = h("div", { class: "oshi-selector__grid", attr: { role: "group", "aria-label": "Starter oshis" } });
  const costumeGrid = h("div", { class: "oshi-selector__costumes", attr: { role: "group", "aria-label": "Oshi costumes" } });
  const setCharacterPressed = pressedGroup(characterButtons, "oshi-selector__option--selected");
  const setCostumePressed = pressedGroup(costumeButtons, "oshi-selector__costume--selected");

  const selectedCharacterOption = (): OshiOption => opts.costumes(selectedCharacterId)[0] ?? selectedOshi;

  const selectCostume = (oshi: OshiOption): void => {
    selectedOshi = oshi;
    selectedId = oshi.id;
    selectedCharacterId = oshi.characterId;
    setCharacterPressed(selectedCharacterId);
    setCostumePressed(selectedId);
  };

  const renderCostumes = (): void => {
    costumeButtons.clear();
    const costumes = opts.costumes(selectedCharacterId);
    costumeGrid.hidden = costumes.length <= 1;
    costumeGrid.replaceChildren(
      ...costumes.map((oshi) => {
        const button = costumeButton(oshi);
        costumeButtons.set(oshi.id, button);
        return button;
      }),
    );
  };

  const selectCharacter = (oshi: OshiOption): void => {
    selectedCharacterId = oshi.characterId;
    const costumes = opts.costumes(selectedCharacterId);
    const sameCharacter = selectedOshi.characterId === selectedCharacterId;
    selectCostume(sameCharacter ? selectedOshi : (costumes[0] ?? oshi));
    renderCostumes();
  };

  const render = (options: readonly OshiOption[], label: string): void => {
    characterButtons.clear();
    grid.setAttribute("aria-label", label);
    grid.replaceChildren(
      ...options.map((oshi) => {
        const button = optionButton(oshi);
        characterButtons.set(oshi.characterId, button);
        return button;
      }),
    );
    setCharacterPressed(selectedCharacterId);
  };

  const optionButton = (oshi: OshiOption): HTMLButtonElement => {
    const selected = oshi.characterId === selectedCharacterId;
    return h(
      "button",
      {
        class: `oshi-selector__option${selected ? " oshi-selector__option--selected" : ""}`,
        attr: { type: "button", "aria-pressed": String(selected) },
        on: { click: () => selectCharacter(oshi) },
      },
      h("img", { class: "oshi-selector__icon", attr: { src: oshi.icon, alt: "", width: 80, height: 80 } }),
      h("span", { class: "oshi-selector__name" }, oshi.name),
    );
  };

  const costumeButton = (oshi: OshiOption): HTMLButtonElement => {
    const selected = oshi.id === selectedId;
    return h(
      "button",
      {
        class: `oshi-selector__costume${selected ? " oshi-selector__costume--selected" : ""}`,
        attr: { type: "button", "aria-pressed": String(selected), title: oshi.costumeName ?? "Portrait" },
        on: { click: () => selectCostume(oshi) },
      },
      h("img", { class: "oshi-selector__costume-portrait", attr: { src: oshi.portrait, alt: "", width: 88, height: 88 } }),
      h("span", { class: "oshi-selector__costume-name" }, oshi.costumeName ?? "Portrait"),
    );
  };

  const search = h("input", {
    class: "oshi-selector__search",
    attr: { type: "search", placeholder: "Search oshi", "aria-label": "Search oshi", autocomplete: "off" },
    on: {
      input: () => {
        const query = search.value.trim();
        const character = selectedCharacterOption();
        const options = query ? searchOshis(character, opts.search(query)) : starterOshis(character);
        render(options, query ? "Search results" : "Starter oshis");
      },
    },
  });

  render(starterOshis(selectedCharacterOption()), "Starter oshis");
  renderCostumes();

  return h(
    "section",
    { class: "oshi-selector" },
    h("h2", { class: "oshi-selector__title" }, "Choose Oshi"),
    search,
    grid,
    costumeGrid,
    surfaceActions(
      // Esc backs out while the shown oshi is still the committed one; a staged pick the
      // player hasn't OK'd is pending, so Esc holds.
      surfaceCancel({ class: "oshi-selector__cancel", onCancel: opts.onClose, escSafe: () => selectedId === initialId }),
      h(
        "button",
        {
          class: "oshi-selector__ok",
          attr: { type: "button" },
          on: {
            click: () => {
              opts.onCommit(selectedOshi);
              opts.onClose();
            },
          },
        },
        "OK",
      ),
    ),
  );
}
