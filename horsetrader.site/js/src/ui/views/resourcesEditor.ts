/**
 * The balance editor: the **write** half of Resources, lifted out of the surface
 * into its own shield (the oshi selector is the reference impl). It is a focused
 * transcription transaction — you copy the values straight off the game and hit
 * Save; the reading is stamped *now* (UTC) and folds forward as the projection
 * origin. There is no date input and no history: a save just replaces the one
 * stored snapshot with the current moment. It owns its draft state in the inputs
 * and reads it back only on commit; the surface behind it stays a pure read. See
 * [[feedback_shield_vs_unfold]] for why this is a shield and play style is not.
 */

import "./resourcesEditor.css";

import { h } from "../h.ts";
import { RESOURCE_ROWS, cellHeading, resourceGrid, type Cell } from "./resourceLayout.ts";
import type { ResourceVector } from "../../core/projection/index.ts";
import type { Snapshot } from "../../core/persistence/document.ts";

export interface ResourcesEditorOpts {
  snapshot: Snapshot | undefined;
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

  const dailyPack = h("input", { attr: { type: "checkbox" } });

  // No date input: the reading is stamped at the moment of Save (the action-time
  // pattern, like rushed flags). We keep only the most recent snapshot — its full
  // UTC instant is the wall-clock truth; `date` is its day, the projection origin.
  const collect = (): Snapshot => {
    const resources: ResourceVector = {};
    for (const row of RESOURCE_ROWS) {
      for (const cell of row) resources[cell.key] = inputs.get(cell.key)!.valueAsNumber || 0;
    }
    const recordedAt = new Date().toISOString();
    return { date: recordedAt.slice(0, 10), recordedAt, resources };
  };

  return h(
    "section",
    { class: "resources-editor" },
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
