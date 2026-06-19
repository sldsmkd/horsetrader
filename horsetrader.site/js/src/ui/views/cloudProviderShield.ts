/**
 * The Cloud Provider shield — the write half of "connect a cloud" (the editor-as-shield
 * tenet — [[feedback_shield_vs_unfold]]; the cloud conflict dialog is the sibling
 * cloud modal). The trainer card's Cloud button reads a connection; *changing* it
 * (connect a provider / disconnect) is a deliberate action, so it gets a shield, not an
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
 * Behaves like every other shield (oshi/club/balance/commit): a plain BODY rendered into
 * the overlay layer by the app shell, tracked in view-state (`cloudConnecting`) so it
 * suspends the trainer card behind it and locks the menu spawners — no self-mounted scrim,
 * so the timeline stays live behind it (ui.md principle 1). The `onClose` it returns
 * through is the shell's view-state reset.
 */

import "./cloudProviderShield.css";

import { h } from "../h.ts";
import { presentConfirmShield } from "./confirmShield.ts";
import { CLOUD_PROVIDERS, connect, disconnect, switchProvider } from "../../core/cloud/index.ts";
import type { AuthState } from "../../core/cloud/index.ts";
import type { Coordinator } from "../../core/engine/index.ts";

export interface CloudProviderShieldOpts {
  /** The account state the lifecycle ops act on (disconnect/switch touch its sync meta). */
  coord: Coordinator;
  auth: AuthState;
  /** Fired when the user ends up signed out (disconnect-and-stay) — the caller refreshes
   *  its auth state. A switch redirects to the new provider instead, so it skips this. */
  onSignedOut: () => void;
  /** Close the shield (the shell clears `cloudConnecting`). Called by the overlay's own
   *  close control AND after a completed disconnect. */
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
  // The destructive paths confirm first; all three are cloud-service operations — this
  // view only renders + routes.
  function onToggle(id: string, on: boolean): void {
    if (on) confirmDisconnect(labelOf(id));
    else if (connected) confirmSwitch(connected, id);
    else connect(id); // first connect — non-destructive, straight to OAuth.
  }

  function confirmDisconnect(label: string): void {
    presentConfirmShield({
      title: "Disconnect cloud",
      message: `Disconnect from ${label} and delete its cloud save? Your local plan stays on this device, but the cloud copy is removed and can't be recovered.`,
      confirmLabel: "Disconnect",
      danger: true,
      onConfirm: async () => {
        await disconnect(opts.coord); // a failed delete throws → confirm stays open to retry
        opts.onSignedOut();
        opts.onClose();
      },
    });
  }

  function confirmSwitch(fromId: string, toId: string): void {
    presentConfirmShield({
      title: "Switch cloud provider",
      message: `Switch to ${labelOf(toId)}? This disconnects ${labelOf(fromId)} and deletes its cloud save, then signs you in with ${labelOf(toId)}. Your local plan stays on this device.`,
      confirmLabel: `Switch to ${labelOf(toId)}`,
      danger: true,
      onConfirm: () => switchProvider(opts.coord, toId), // disconnects then redirects (tears the page down)
    });
  }

  // The shield BODY only — the app shell wraps it in `overlay({ title:"Cloud Save",
  // placement:"center" })`, which supplies the header + close control + non-blocking
  // chrome, exactly like the oshi/club/balance shields.
  return h("div", { class: "cloud-provider" }, intro, list);
}
