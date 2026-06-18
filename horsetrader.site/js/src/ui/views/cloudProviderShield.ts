/**
 * The Cloud Provider shield — the write half of "connect a cloud" (the editor-as-shield
 * tenet — [[feedback_shield_vs_unfold]]; the cloud conflict dialog is the sibling
 * cloud modal). The beta surface's Cloud button reads a connection; *changing* it
 * (connect a provider / disconnect) is a deliberate action, so it gets a modal, not an
 * inline unfold.
 *
 * Two states behind one card:
 *   - disconnected → the provider picker, one button per {@link CLOUD_PROVIDERS} entry
 *     (Google now, Discord later — list-driven, so a new provider is a registry line).
 *     A pick is a full-page OAuth redirect (`startSignIn`), so the shield never needs
 *     to close itself on connect — the navigation tears the whole page down.
 *   - connected → the identity line + Sign out (the disconnect flow lives here now, not
 *     the chamber stopgap it replaced).
 *
 * Self-contained modal: fixed scrim + centred card, mounted on `document.body` and torn
 * down on close. `presentCloudProviderShield` is the single mount/teardown entry.
 */

import "./cloudProviderShield.css";

import { h } from "../h.ts";
import { CLOUD_PROVIDERS, signOut, startSignIn } from "../../core/cloud/client.ts";
import type { AuthState } from "../../core/cloud/client.ts";

export interface CloudProviderShieldOpts {
  auth: AuthState;
  /** Fired after the cloud session is cleared — the caller refreshes its auth state. */
  onSignedOut: () => void;
  onClose: () => void;
}

export function cloudProviderShield(opts: CloudProviderShieldOpts): HTMLElement {
  const body: Node[] = [];

  if (opts.auth.authenticated) {
    const { provider, sub } = opts.auth.identity;
    const label = CLOUD_PROVIDERS.find((p) => p.id === provider)?.label ?? provider;
    body.push(
      h(
        "p",
        { class: "cloud-provider__intro" },
        `Connected to ${label}. Your plan syncs to this account.`,
      ),
      h(
        "div",
        { class: "cloud-provider__identity" },
        h("span", { class: "cloud-provider__identity-label" }, label),
        h("span", { class: "cloud-provider__identity-sub" }, sub),
      ),
      h(
        "button",
        {
          class: "cloud-provider__btn cloud-provider__btn--danger",
          attr: { type: "button" },
          on: { click: () => void doSignOut() },
        },
        "Sign out",
      ),
    );
  } else {
    body.push(h("p", { class: "cloud-provider__intro" }, "Pick a cloud to connect — your plan syncs to that account."));
    const list = h("div", { class: "cloud-provider__list" });
    for (const provider of CLOUD_PROVIDERS) {
      list.append(
        h(
          "button",
          {
            class: "cloud-provider__option",
            attr: { type: "button" },
            // Full-page OAuth redirect; no close needed — the navigation tears us down.
            on: { click: () => startSignIn(provider.id) },
          },
          h("span", { class: "cloud-provider__icon" }, provider.icon),
          h("span", { class: "cloud-provider__option-label" }, `Continue with ${provider.label}`),
        ),
      );
    }
    body.push(list);
  }

  async function doSignOut(): Promise<void> {
    await signOut();
    opts.onSignedOut();
    opts.onClose();
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
      ...body,
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
