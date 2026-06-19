/**
 * The Cloud Conflict dialog — Unity's pick-a-side resolution (resolution.md P6),
 * modelled on Steam Cloud's conflict prompt. Both local and cloud diverged since the
 * last sync; the user keeps one whole plan and the other is overwritten. No merge.
 *
 * Self-contained modal: a fixed scrim + centred card. Requires a conscious pick
 * (Continue stays disabled until a side is chosen — avoids a one-click clobber), and
 * a live consequence line spells out what the current choice overwrites. The caller
 * mounts it (appends to the document) and removes it from the `onResolve`/`onCancel`
 * callbacks.
 */

import "./cloudConflict.css";

import { h } from "../h.ts";
import { keepCloud, keepLocal } from "../../core/cloud/index.ts";
import type { CloudConflict, PlanFacts } from "../../core/cloud/index.ts";
import type { Coordinator } from "../../core/engine/index.ts";

export interface CloudConflictOpts {
  local: PlanFacts;
  cloud: PlanFacts;
  /** The chosen side is kept; the other is overwritten. */
  onResolve: (keep: "cloud" | "local") => void;
  onCancel: () => void;
}

function factsLine(f: PlanFacts): string {
  const parts = [f.trainerName, `${f.commitments} banners`, `${f.favourites} favourites`];
  if (f.rushed) parts.push(`${f.rushed} rushed`);
  if (f.snapshot) parts.push(f.snapshot);
  return parts.join(" · ");
}

export function cloudConflictDialog(opts: CloudConflictOpts): HTMLElement {
  let keep: "cloud" | "local" | null = null;

  const consequence = h("p", { class: "cloud-conflict__consequence" });
  const continueBtn = h(
    "button",
    {
      class: "cloud-conflict__btn cloud-conflict__btn--primary",
      attr: { type: "button" },
      on: { click: () => keep && opts.onResolve(keep) },
    },
    "Continue",
  );

  const option = (side: "cloud" | "local", title: string, icon: string, facts: PlanFacts): HTMLButtonElement =>
    h(
      "button",
      {
        class: "cloud-conflict__option",
        attr: { type: "button" },
        on: {
          click: () => {
            keep = side;
            sync();
          },
        },
      },
      h("span", { class: "cloud-conflict__radio" }),
      h("span", { class: "cloud-conflict__icon" }, icon),
      h(
        "span",
        { class: "cloud-conflict__option-text" },
        h("span", { class: "cloud-conflict__option-title" }, title),
        h("span", { class: "cloud-conflict__option-facts" }, factsLine(facts)),
      ),
    );

  const cloudOpt = option("cloud", "Cloud Save", "☁", opts.cloud);
  const localOpt = option("local", "Local Save", "💾", opts.local);

  function sync(): void {
    cloudOpt.classList.toggle("cloud-conflict__option--selected", keep === "cloud");
    localOpt.classList.toggle("cloud-conflict__option--selected", keep === "local");
    continueBtn.disabled = keep === null;
    consequence.textContent =
      keep === "cloud"
        ? "Your local plan will be overwritten with the cloud version."
        : keep === "local"
          ? "The cloud copy will be overwritten with your local plan."
          : "Choose which version to keep — the other will be overwritten.";
  }
  sync();

  return h(
    "div",
    { class: "cloud-conflict", attr: { role: "dialog", "aria-modal": "true", "aria-label": "Cloud conflict" } },
    h(
      "div",
      { class: "cloud-conflict__card" },
      h(
        "div",
        { class: "cloud-conflict__header" },
        h("span", { class: "cloud-conflict__warn" }, "❗"),
        h("h2", { class: "cloud-conflict__title" }, "Cloud Conflict"),
      ),
      h(
        "p",
        { class: "cloud-conflict__intro" },
        "Your local plan conflicts with the version stored in the cloud. Whichever you keep is synced to this device and the cloud; the one you don't keep is overwritten.",
      ),
      h("div", { class: "cloud-conflict__options" }, cloudOpt, localOpt),
      consequence,
      h(
        "div",
        { class: "cloud-conflict__actions" },
        h("button", { class: "cloud-conflict__btn", attr: { type: "button" }, on: { click: opts.onCancel } }, "Cancel"),
        continueBtn,
      ),
    ),
  );
}

/**
 * Mount the conflict dialog for a detected `CloudConflict`, wire pick-a-side to the
 * resolution helpers, and tear it down on choice/cancel. The single place both the
 * load-time path (app.ts) and the manual Sync (betaSurface) raise the prompt, so the
 * mounting + resolution glue isn't duplicated. `onResolved` reports a short outcome
 * string (for the beta status line); the coordinator notify it triggers re-renders
 * the rest of the app.
 */
export function presentCloudConflict(
  coord: Coordinator,
  conflict: CloudConflict,
  onResolved?: (outcome: string) => void,
): void {
  let dialog: HTMLElement;
  const done = (outcome: string): void => {
    dialog.remove();
    onResolved?.(outcome);
  };
  dialog = cloudConflictDialog({
    local: conflict.localFacts,
    cloud: conflict.cloudFacts,
    onResolve: (choice) => {
      if (choice === "cloud") {
        keepCloud(coord, conflict.cloudDoc, conflict.cloudEtag);
        done("kept cloud");
      } else {
        void keepLocal(coord, conflict.cloudEtag).then((push) =>
          done(push.ok ? "kept local (pushed up)" : `keep-local failed (status ${push.status})`),
        );
      }
    },
    onCancel: () => done("cancelled (local kept, not synced)"),
  });
  document.body.appendChild(dialog);
}
