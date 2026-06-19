import "./oshiSelector.css";

import { DEFAULT_OSHI_ID, searchOshis, starterOshis } from "../query/index.ts";
import type { OshiOption, OshiSearchIndex } from "../query/index.ts";
import { h } from "../h.ts";
import { pressedGroup } from "../widgets/pressedGroup.ts";
import { surfaceActions } from "./surfaceActions.ts";

export interface OshiSelectorOpts {
  selectedId?: string;
  selected: OshiOption;
  search: OshiSearchIndex;
  onCommit: (oshi: OshiOption) => void;
  onClose: () => void;
}

export function oshiSelector(opts: OshiSelectorOpts): HTMLElement {
  let selectedId = opts.selectedId ?? DEFAULT_OSHI_ID;
  let selectedOshi = opts.selected;
  const buttons = new Map<string, HTMLButtonElement>();
  const grid = h("div", { class: "oshi-selector__grid", attr: { role: "group", "aria-label": "Starter oshis" } });
  const setPressed = pressedGroup(buttons, "oshi-selector__option--selected");

  const select = (oshi: OshiOption): void => {
    selectedId = oshi.id;
    selectedOshi = oshi;
    setPressed(selectedId);
  };

  const render = (options: readonly OshiOption[], label: string): void => {
    buttons.clear();
    grid.setAttribute("aria-label", label);
    grid.replaceChildren(
      ...options.map((oshi) => {
        const button = optionButton(oshi);
        buttons.set(oshi.id, button);
        return button;
      }),
    );
  };

  const optionButton = (oshi: OshiOption): HTMLButtonElement => {
    const selected = oshi.id === selectedId;
    return h(
      "button",
      {
        class: `oshi-selector__option${selected ? " oshi-selector__option--selected" : ""}`,
        attr: { type: "button", "aria-pressed": String(selected) },
        on: { click: () => select(oshi) },
      },
      h("img", { class: "oshi-selector__icon", attr: { src: oshi.icon, alt: "", width: 80, height: 80 } }),
      h("span", { class: "oshi-selector__name" }, oshi.name),
    );
  };

  const search = h("input", {
    class: "oshi-selector__search",
    attr: { type: "search", placeholder: "Search oshi", "aria-label": "Search oshi", autocomplete: "off" },
    on: {
      input: () => {
        const query = search.value.trim();
        const options = query ? searchOshis(selectedOshi, opts.search(query)) : starterOshis(selectedOshi);
        render(options, query ? "Search results" : "Starter oshis");
      },
    },
  });

  render(starterOshis(selectedOshi), "Starter oshis");

  return h(
    "section",
    { class: "oshi-selector" },
    h("h2", { class: "oshi-selector__title" }, "Choose Oshi"),
    search,
    grid,
    surfaceActions(
      h("button", { class: "oshi-selector__cancel", attr: { type: "button" }, on: { click: opts.onClose } }, "Cancel"),
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
