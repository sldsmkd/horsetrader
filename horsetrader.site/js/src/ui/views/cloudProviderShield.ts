/**
 * The Cloud Provider shield — the write half of "connect a cloud" (the editor-as-shield
 * tenet — [[feedback_shield_vs_unfold]]; the cloud conflict dialog is the sibling
 * cloud modal). The beta surface's Cloud button reads a connection; *changing* it
 * (connect a provider / disconnect) is a deliberate action, so it gets a modal, not an
 * inline unfold.
 *
 * One radio-style toggle list, one row per {@link CLOUD_PROVIDERS} entry (Google now,
 * Discord later — list-driven, so a new provider is a registry line). At most one is ON
 * (= the connected provider, pushed-in/highlighted), matching the no-account-linking,
 * one-provider-at-a-time rule (design.md §6). Three click paths:
 *   - none connected → click any → plain connect (full-page OAuth redirect; the
 *     navigation tears the page down, so no self-close needed).
 *   - click the ON row → toggle off = DISCONNECT (destructive — deletes the cloud save,
 *     design.md §7) → confirm shield-of-a-shield first.
 *   - one connected → click a DIFFERENT row → SWITCH: disconnect the current (same
 *     destructive confirm) then redirect to the new provider's OAuth. No linking, so a
 *     switch is a clean break, not a merge.
 *
 * Self-contained modal: fixed scrim + centred card, mounted on `document.body` and torn
 * down on close. `presentCloudProviderShield` is the single mount/teardown entry.
 */

import "./cloudProviderShield.css";

import { h } from "../h.ts";
import { presentConfirmShield } from "./confirmShield.ts";
import { CLOUD_PROVIDERS, deleteSave, signOut, startSignIn } from "../../core/cloud/client.ts";
import type { AuthState } from "../../core/cloud/client.ts";

export interface CloudProviderShieldOpts {
  auth: AuthState;
  /** Fired the moment the cloud save is deleted (disconnect AND switch both delete it) —
   *  the caller forgets the local sync baseline so what's local now needs a fresh push. */
  onCloudDeleted: () => void;
  /** Fired when the user ends up signed out (disconnect-and-stay) — the caller refreshes
   *  its auth state. A switch redirects to the new provider instead, so it skips this. */
  onSignedOut: () => void;
  onClose: () => void;
}

export function cloudProviderShield(opts: CloudProviderShieldOpts): HTMLElement {
  const connected = opts.auth.authenticated ? opts.auth.identity.provider : null;
  const labelOf = (id: string): string => CLOUD_PROVIDERS.find((p) => p.id === id)?.label ?? id;

  const intro = h(
    "p",
    { class: "cloud-provider__intro" },
    connected
      ? "Connected — your plan syncs to this account. Use the same provider on every device."
      : "Connect a cloud — your plan syncs to that account. Pick one and use it on every device.",
  );

  const list = h("div", { class: "cloud-provider__list", attr: { role: "radiogroup" } });
  for (const provider of CLOUD_PROVIDERS) {
    const on = provider.id === connected;
    list.append(
      h(
        "button",
        {
          class: `cloud-provider__option${on ? " cloud-provider__option--on" : ""}`,
          attr: { type: "button", role: "radio", "aria-checked": on },
          on: { click: () => onToggle(provider.id, on) },
        },
        h("span", { class: "cloud-provider__icon" }, provider.icon),
        h("span", { class: "cloud-provider__option-label" }, provider.label),
        on && h("span", { class: "cloud-provider__state" }, "Connected"),
      ),
    );
  }

  // Radio semantics: at most one ON. Clicking the ON row toggles off (disconnect);
  // clicking another while one is on switches; clicking any while none is on connects.
  function onToggle(id: string, on: boolean): void {
    if (on) confirmDisconnect(labelOf(id));
    else if (connected) confirmSwitch(connected, id);
    else startSignIn(id); // first connect — non-destructive, straight to OAuth.
  }

  // Disconnect deletes the cloud save (design.md §7), so the delete must land before we
  // clear the session: a failed delete throws (keeping the confirm open to retry) rather
  // than orphaning the blob behind a cleared session. localStorage is never touched —
  // signing out keeps the local copy (design.md loose-ends).
  async function disconnect(): Promise<void> {
    if (!(await deleteSave())) throw new Error("Couldn't delete the cloud save — try again.");
    await signOut();
    // The blob we were synced to is gone — forget the baseline so local reads as needing
    // a fresh push. Critical for SWITCH: without it the new provider's empty cloud sees a
    // clean local and no-ops, stranding the plan in no cloud at all.
    opts.onCloudDeleted();
  }

  function confirmDisconnect(label: string): void {
    presentConfirmShield({
      title: "Disconnect cloud",
      message: `Disconnect from ${label} and delete its cloud save? Your local plan stays on this device, but the cloud copy is removed and can't be recovered.`,
      confirmLabel: "Disconnect",
      danger: true,
      onConfirm: async () => {
        await disconnect();
        opts.onSignedOut();
        opts.onClose();
      },
    });
  }

  // Switch = a clean break (no linking, design.md §6): fully disconnect the current
  // provider — deleting its save and clearing the session — then redirect to the new
  // one's OAuth. Clearing first means an abandoned OAuth lands back signed-out and clean,
  // never half-switched.
  function confirmSwitch(fromId: string, toId: string): void {
    presentConfirmShield({
      title: "Switch cloud provider",
      message: `Switch to ${labelOf(toId)}? This disconnects ${labelOf(fromId)} and deletes its cloud save, then signs you in with ${labelOf(toId)}. Your local plan stays on this device.`,
      confirmLabel: `Switch to ${labelOf(toId)}`,
      danger: true,
      onConfirm: async () => {
        await disconnect();
        startSignIn(toId); // full-page redirect — tears the page (and this modal) down.
      },
    });
  }

  return h(
    "div",
    {
      class: "cloud-provider",
      attr: { role: "dialog", "aria-modal": "true", "aria-label": "Cloud provider" },
      // Click the scrim (but not the card) to dismiss.
      on: { click: (e) => e.target === e.currentTarget && opts.onClose() },
    },
    h(
      "div",
      { class: "cloud-provider__card" },
      h(
        "div",
        { class: "cloud-provider__header" },
        h("h2", { class: "cloud-provider__title" }, "Cloud Save"),
        h(
          "button",
          { class: "cloud-provider__close", attr: { type: "button", "aria-label": "Close" }, on: { click: opts.onClose } },
          "✕",
        ),
      ),
      intro,
      list,
    ),
  );
}

/** Mount the shield, wire teardown into both exits, and append it to the document.
 *  The single place the beta surface (and, when Unity graduates, the menubar) raises
 *  the connect/disconnect modal — so the mount/teardown glue isn't duplicated. */
export function presentCloudProviderShield(opts: Omit<CloudProviderShieldOpts, "onClose">): void {
  let shield: HTMLElement;
  const close = (): void => shield.remove();
  shield = cloudProviderShield({ ...opts, onClose: close });
  document.body.appendChild(shield);
}
