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
import { surfaceActions } from "./surfaceActions.ts";
import { CLOUD_PROVIDERS, connect, disconnect, switchProvider } from "../../core/cloud/index.ts";
import type { AuthState, CloudProvider } from "../../core/cloud/index.ts";
import type { Coordinator } from "../../core/engine/index.ts";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface CloudProviderShieldOpts {
  /** The account state the lifecycle ops act on (disconnect/switch touch its sync meta). */
  coord: Coordinator;
  auth: AuthState;
  /** Fired when the user ends up signed out (disconnect-and-stay) — the caller refreshes
   *  its auth state. A switch redirects to the new provider instead, so it skips this. */
  onSignedOut: () => void;
  /** Close the shield (the shell clears `cloudConnecting`). Called by Cancel and after
   *  a completed disconnect. */
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
          class: `cloud-provider__option cloud-provider__option--${provider.brand}${on ? " cloud-provider__option--on" : ""}`,
          attr: { type: "button", role: "radio", "aria-checked": on },
          on: { click: () => onToggle(provider.id, on) },
        },
        h("span", { class: "cloud-provider__icon" }, providerMark(provider)),
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

  // The shield BODY only — the app shell wraps it in a headerless overlay. Dismissal
  // lives here as an explicit Cancel action, matching the other write shields.
  return h(
    "div",
    { class: "cloud-provider" },
    h("h2", { class: "cloud-provider__title" }, "Cloud Save"),
    intro,
    list,
    surfaceActions(h("button", { class: "cloud-provider__cancel", attr: { type: "button" }, on: { click: opts.onClose } }, "Cancel")),
  );
}

function providerMark(provider: CloudProvider): SVGSVGElement {
  switch (provider.brand) {
    case "google":
      return googleMark();
    case "discord":
      return discordMark();
  }
}

function googleMark(): SVGSVGElement {
  return svg(
    "svg",
    { class: "cloud-provider__mark", viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" },
    svg("path", {
      fill: "#4285f4",
      d: "M23.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.5c-.3 1.5-1.1 2.8-2.3 3.6v3h3.7c2.2-2 3.6-5 3.6-8.6z",
    }),
    svg("path", {
      fill: "#34a853",
      d: "M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-3c-1 .7-2.4 1.1-4.2 1.1-3.1 0-5.7-2.1-6.6-4.9H1.6v3.1C3.5 21.3 7.5 24 12 24z",
    }),
    svg("path", {
      fill: "#fbbc05",
      d: "M5.4 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.6C.6 8.2 0 10 0 12s.6 3.8 1.6 5.4l3.8-3.1z",
    }),
    svg("path", {
      fill: "#ea4335",
      d: "M12 4.8c1.7 0 3.3.6 4.5 1.8L19.9 3C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.7 1.6 6.6l3.8 3.1C6.3 6.9 8.9 4.8 12 4.8z",
    }),
  );
}

function discordMark(): SVGSVGElement {
  return svg(
    "svg",
    { class: "cloud-provider__mark", viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" },
    svg("path", {
      fill: "currentColor",
      d: "M20.3 4.4A19 19 0 0 0 15.5 3l-.2.4c1.7.5 2.5 1.2 2.5 1.2A16.5 16.5 0 0 0 12 3.5a16.5 16.5 0 0 0-5.8 1.1s.8-.7 2.6-1.2L8.5 3a19 19 0 0 0-4.8 1.4C.7 8.9-.1 13.3.3 17.7A19.4 19.4 0 0 0 6.2 21l.7-1.2c-1.3-.5-2-1.3-2-1.3l.5.3c.1.1.2.1.3.2A13.7 13.7 0 0 0 12 20.4a13.7 13.7 0 0 0 6.3-1.4l.3-.2.5-.3s-.7.8-2 1.3l.7 1.2a19.4 19.4 0 0 0 5.9-3.3c.5-5.1-.8-9.5-3.4-13.3zM8.5 15.3c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2zm7 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2z",
    }),
  );
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  ...children: SVGElement[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, String(value));
  }
  for (const child of children) el.append(child);
  return el;
}
