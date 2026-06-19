/**
 * confirmShield — the "shield-of-a-shield": a small alert/confirm modal that a shield
 * raises to gate a destructive action. It paints above the shield layer (CSS z-index
 * 1100 > the 1000 shields) so it blocks the shield that spawned it *and* the rest of
 * the foreground UI — modal to everything, owned by the shield beneath it.
 *
 * It owns the action, not just the yes/no: `onConfirm` may be async, and while it runs
 * the buttons go busy; a rejection is shown inline and the modal stays open to retry,
 * so a flaky destructive call (a failed cloud-save delete) never leaves the user
 * stranded with no context. Resolve/return → close.
 *
 * First use: disconnect (delete the cloud save) in {@link cloudProviderShield}. Kept
 * generic — a confirm gate is the sort of thing a second caller will want — but no more
 * configurable than that first need warrants ([[feedback_shield_vs_unfold]] sibling).
 */

import "./confirmShield.css";

import { h } from "../h.ts";

export interface ConfirmShieldOpts {
  title: string;
  message: string;
  /** Label for the affirmative button (e.g. "Disconnect"). */
  confirmLabel: string;
  /** Label for the dismiss button; defaults to "Cancel". */
  cancelLabel?: string;
  /** Style the confirm button as destructive (the disconnect case). */
  danger?: boolean;
  /** The action to run on confirm. If it returns a promise the modal goes busy until it
   *  settles; a rejection is surfaced inline and the modal stays open. */
  onConfirm: () => void | Promise<void>;
  /** Optional dismiss hook (Cancel / scrim click), fired before teardown. */
  onCancel?: () => void;
}

/** Mount a confirm modal on the body, wire teardown into both exits. The single entry —
 *  callers never touch the mount/scrim glue. */
export function presentConfirmShield(opts: ConfirmShieldOpts): void {
  let shield: HTMLElement;
  const close = (): void => shield.remove();

  const error = h("p", { class: "confirm-shield__error", attr: { hidden: true } });
  const cancelBtn = h(
    "button",
    { class: "confirm-shield__btn", attr: { type: "button" }, on: { click: () => cancel() } },
    opts.cancelLabel ?? "Cancel",
  );
  const confirmBtn = h(
    "button",
    {
      class: `confirm-shield__btn${opts.danger ? " confirm-shield__btn--danger" : ""}`,
      attr: { type: "button" },
      on: { click: () => void confirm() },
    },
    opts.confirmLabel,
  );

  function cancel(): void {
    opts.onCancel?.();
    close();
  }

  function setBusy(busy: boolean): void {
    cancelBtn.disabled = busy;
    confirmBtn.disabled = busy;
  }

  async function confirm(): Promise<void> {
    error.hidden = true;
    setBusy(true);
    try {
      await opts.onConfirm();
      close();
    } catch (err) {
      error.textContent = String(err);
      error.hidden = false;
      setBusy(false);
    }
  }

  shield = h(
    "div",
    {
      class: "confirm-shield",
      attr: { role: "alertdialog", "aria-modal": "true", "aria-label": opts.title },
      // Scrim click (not the card) cancels — same affordance as the shields beneath.
      on: { click: (e) => e.target === e.currentTarget && cancel() },
    },
    h(
      "div",
      { class: "confirm-shield__card" },
      h("h2", { class: "confirm-shield__title" }, opts.title),
      h("p", { class: "confirm-shield__message" }, opts.message),
      error,
      h("div", { class: "confirm-shield__actions" }, cancelBtn, confirmBtn),
    ),
  );
  document.body.appendChild(shield);
}
