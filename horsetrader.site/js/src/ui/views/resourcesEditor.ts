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

/** The transcription this shield commits: the resource reading, the Daily Carat Pack
 *  subscription's validity date (`null` when not subscribed), and whether the player
 *  owns the Training Pass premium track. */
export interface ResourcesDraft {
  snapshot: Snapshot;
  dailyPack: string | null;
  trainingPass: boolean;
}

export interface ResourcesEditorOpts {
  snapshot: Snapshot | undefined;
  /** The current subscription validity date (`config.dailyPack`), or `null` if unset. */
  dailyPack: string | null;
  /** Whether the player owns the Training Pass premium track (`config.trainingPass`). */
  trainingPass: boolean;
  onCommit: (draft: ResourcesDraft) => void;
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

  // "Dolphin mode": the Daily Carat Pack as an always-on subscription. The checkbox
  // enables it and reveals the one input it needs — the validity date straight off the
  // game's UI ("additional purchase available from …"), a cycle boundary we phase the
  // 30-day billing cadence off. Income (50 free/day + 500 paid/cycle) is synthesised by
  // the daily-pack channel; here we only transcribe the subscription's existence + date.
  const packToggle = h("input", {
    attr: opts.dailyPack ? { type: "checkbox", checked: "" } : { type: "checkbox" },
    on: { change: () => syncPack() },
  });
  const packDate = h("input", {
    class: "resources-editor__pack-date",
    attr: { type: "date", value: opts.dailyPack ?? "" },
  });
  const packDateField = h(
    "label",
    { class: "resources-editor__pack-date-field" },
    "Next purchase date",
    packDate,
  );
  const syncPack = (): void => {
    packDateField.hidden = !packToggle.checked;
  };
  syncPack();

  // Training Pass premium track — the dolphin family's second paid toggle. Unlike the
  // pack it needs no date: it's a binary "I own premium", and the boost it unlocks lands
  // on each Training Pass event (baked dates) via the training-pass channel. Free-track
  // rewards already count for everyone, so this transcribes only the premium ownership.
  const passToggle = h("input", {
    attr: opts.trainingPass ? { type: "checkbox", checked: "" } : { type: "checkbox" },
  });

  // The reading is stamped at the moment of Save (the action-time pattern, like rushed
  // flags). We keep only the most recent snapshot — its full UTC instant is the
  // wall-clock truth; `date` is its day, the projection origin. The pack date is the
  // one transcribed value (presence ⇒ subscribed), `null` when the toggle is off.
  const collect = (): ResourcesDraft => {
    const resources: ResourceVector = {};
    for (const row of RESOURCE_ROWS) {
      for (const cell of row) resources[cell.key] = inputs.get(cell.key)!.valueAsNumber || 0;
    }
    const recordedAt = new Date().toISOString();
    const snapshot: Snapshot = { date: recordedAt.slice(0, 10), recordedAt, resources };
    const dailyPack = packToggle.checked && packDate.value ? packDate.value : null;
    return { snapshot, dailyPack, trainingPass: passToggle.checked };
  };

  return h(
    "section",
    { class: "resources-editor" },
    resourceGrid(editCell),
    h(
      "label",
      { class: "resources-editor__daily-pack" },
      packToggle,
      "I spend money for the Daily Carats pack",
    ),
    packDateField,
    h(
      "label",
      { class: "resources-editor__daily-pack" },
      passToggle,
      "I buy the Training Pass premium track",
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
