/**
 * Search box view: the typeahead UI that turns a query into either clickable
 * find-and-warp results or a passive "too broad" count. The index itself is
 * built elsewhere; this view only acts on it.
 */

import "./searchBox.css";

import { h } from "../h.ts";
import type { SearchIndex, SearchResult } from "../search/index.ts";

const SEARCH_RESULT_CAP = 8;

export interface SearchBoxOpts {
  search: SearchIndex;
  onSearch: (result: SearchResult) => void;
}

export function searchBox(opts: SearchBoxOpts): HTMLElement {
  const input = h("input", {
    class: "search-box__input",
    attr: { type: "search", placeholder: "Search", "aria-label": "Search timeline", autocomplete: "off" },
  });
  const resultsEl = h("div", { class: "search-box__results", attr: { role: "listbox" } });
  let results: readonly SearchResult[] = [];

  const choose = (result: SearchResult) => {
    input.value = result.label;
    resultsEl.replaceChildren();
    opts.onSearch(result);
  };
  const resultButton = (result: SearchResult) =>
    h(
      "button",
      {
        class: "search-box__result",
        attr: { type: "button", role: "option" },
        on: {
          pointerdown: (ev) => ev.preventDefault(),
          click: () => choose(result),
        },
      },
      result.label,
    );
  const renderResults = () => {
    const query = input.value.trim();
    results = query ? opts.search(query) : [];
    if (results.length > SEARCH_RESULT_CAP) {
      resultsEl.replaceChildren(h("div", { class: "search-box__count", attr: { role: "status" } }, `${results.length} results found`));
      return;
    }
    resultsEl.replaceChildren(...results.map((result) => resultButton(result)));
  };

  return h(
    "form",
    {
      class: "menubar__item search-box",
      attr: { role: "search" },
      on: {
        input: renderResults,
        focusin: renderResults,
        focusout: () => window.setTimeout(() => resultsEl.replaceChildren(), 0),
        submit: (ev) => {
          ev.preventDefault();
          if (results.length > 0 && results.length <= SEARCH_RESULT_CAP) choose(results[0]!);
        },
      },
    },
    input,
    resultsEl,
  );
}
