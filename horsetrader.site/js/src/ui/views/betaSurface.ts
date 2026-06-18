/**
 * The beta surface — Unity's in-app isolation chamber (design.md §9). A grab-bag
 * of WIP test affordances behind the menubar's Beta (🔨) button; for now it
 * drives the unity-sync auth round-trip end-to-end without touching the main
 * persistence path. Self-contained: it owns its own async (polls /api/me on
 * mount) and updates in place — the app shell only opens/closes it.
 *
 * When auth graduates out of beta this surface keeps the rawer dev controls;
 * the proven bits move onto the main app.
 */

import "./betaSurface.css";

import { h } from "../h.ts";
import { fetchAuth, startGoogleSignIn, signOut } from "../../core/cloud/client.ts";

export function betaSurface(): HTMLElement {
  const status = h("pre", { class: "beta-surface__status" }, "checking session…");

  async function refresh(): Promise<void> {
    status.textContent = "checking session…";
    const auth = await fetchAuth();
    status.textContent = auth.authenticated
      ? JSON.stringify({ authenticated: true, ...auth.identity }, null, 2)
      : JSON.stringify({ authenticated: false }, null, 2);
  }

  const button = (label: string, onClick: () => void): HTMLButtonElement =>
    h("button", { class: "beta-surface__btn", attr: { type: "button" }, on: { click: onClick } }, label);

  const section = h(
    "section",
    { class: "beta-surface" },
    h("h3", { class: "beta-surface__group" }, "Unity — cloud auth"),
    h("p", { class: "beta-surface__note" }, "Talks to the unity-sync Worker (same-origin /api/*). Sign-in is a full-page redirect; on return this shows your session identity."),
    h(
      "div",
      { class: "beta-surface__row" },
      button("Sign in with Google", startGoogleSignIn),
      button("Refresh /api/me", () => void refresh()),
      button("Sign out", async () => {
        await signOut();
        await refresh();
      }),
    ),
    status,
  );

  void refresh();
  return section;
}
