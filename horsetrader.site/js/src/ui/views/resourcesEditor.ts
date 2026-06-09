/**
 * The balance editor: the **write** half of Resources, lifted out of the surface
 * into its own shield (the oshi selector is the reference impl). It is a focused
 * transcription transaction — you record what you actually have as-of a date, hit
 * Save, and it folds forward as the projection origin. It owns its draft state in
 * the inputs and reads it back only on commit; the surface behind it stays a pure
 * read. See [[feedback_shield_vs_unfold]] for why this is a shield and play style
 * is not.
 */

import "./resourcesEditor.css";

import { h } from "../h.ts";
import { RESOURCE_ROWS, cellHeading, resourceGrid, type Cell } from "./resourceLayout.ts";
import type { ResourceVector } from "../../core/projection/index.ts";
import type { Snapshot } from "../../core/persistence/document.ts";

export interface ResourcesEditorOpts {
  snapshot: Snapshot | undefined;
  now: string;
  onCommit: (snapshot: Snapshot) => void;
  onClose: () => void;
}

export function resourcesEditor(opts: ResourcesEditorOpts): HTMLElement {
  const values = opts.snapshot?.resources ?? {};
  const inputs = new Map<string, HTMLInputElement>();

  const editCell = (cell: Cell): HTMLElement => {
    const input = h("input", {
      class: "resource-field__input",
      attr: { type: "number", min: "0", step: "1", value: String(values[cell.key] ?? 0), id: `rs-${cell.key}` },
    });
    inputs.set(cell.key, input);
    return h("div", { class: "resources-editor__cell" }, cellHeading(cell, "label", { for: `rs-${cell.key}` }), input);
  };

  const date = h("input", {
    class: "resources-editor__date",
    attr: { type: "date", value: opts.snapshot?.date ?? opts.now, "aria-label": "Reading date" },
  });

  const dailyPack = h("input", { attr: { type: "checkbox" } });

  const collect = (): Snapshot => {
    const resources: ResourceVector = {};
    for (const row of RESOURCE_ROWS) {
      for (const cell of row) resources[cell.key] = inputs.get(cell.key)!.valueAsNumber || 0;
    }
    return { date: date.value || opts.now, resources };
  };

  return h(
    "section",
    { class: "resources-editor" },
    h(
      "label",
      { class: "resources-editor__as-of" },
      h("span", { class: "resources-editor__as-of-label" }, "As of"),
      date,
    ),
    resourceGrid(editCell),
    h(
      "label",
      { class: "resources-editor__daily-pack" },
      dailyPack,
      "I spend money for the Daily Carats pack",
    ),
    h(
      "footer",
      { class: "resources-editor__actions" },
      h(
        "button",
        { class: "resources-editor__cancel", attr: { type: "button" }, on: { click: opts.onClose } },
        "Cancel",
      ),
      h(
        "button",
        {
          class: "resources-editor__save",
          attr: { type: "button" },
          on: {
            click: () => {
              opts.onCommit(collect());
              opts.onClose();
            },
          },
        },
        "Save",
      ),
    ),
  );
}
