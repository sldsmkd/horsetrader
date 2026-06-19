/**
 * Unity cloud — the service facade: the client's whole cloud surface in one place. The
 * UI depends ONLY on this module; the HTTP transport and the reconcile policy behind it
 * are internal. Everything the cloud does for a planner — read the session, connect /
 * disconnect / switch a provider, sync the plan, resolve a conflict — is an operation
 * here, so no view orchestrates raw transport calls.
 *
 * Three layers, this file being the top:
 *   transport ([client.ts](client.ts)) — the raw `/api/*` endpoints (auth, pull, push,
 *                                         delete) + the OAuth redirect.
 *   reconcile ([sync.ts](sync.ts))      — the resolution.md state table (syncNow,
 *                                         keep-local/keep-cloud).
 *   service (here)                      — account lifecycle that composes the two with
 *                                         browser navigation (the connect marker).
 *
 * Headless like the rest of `core/`; its only outside-world contact is the network
 * (fetch) and navigation (window.location) — the cloud's nature as the I/O seam, not a
 * DOM dependency.
 */

import { deleteSave, signOut, startSignIn } from "./client.ts";
import { syncNow } from "./sync.ts";
import type { SyncResult } from "./sync.ts";
import type { Coordinator } from "../engine/index.ts";

// ── account lifecycle ───────────────────────────────────────────────────────

/** Begin connecting a provider — a full-page OAuth redirect (the page tears down, so
 *  there's nothing to await; the connect completes on the callback's reload). */
export function connect(providerId: string): void {
  startSignIn(providerId);
}

/**
 * Disconnect: delete the cloud save, clear the session, forget the local sync baseline.
 * Order is load-bearing — the delete lands first (and throws on failure, so a caller's
 * confirm can retry) rather than orphaning the blob behind a cleared session. Forgetting
 * the baseline (etag→ø) marks local as needing a fresh push, which is what makes a later
 * reconnect/switch re-create cleanly instead of If-Match-ing a deleted rev (U5).
 */
export async function disconnect(coord: Coordinator): Promise<void> {
  if (!(await deleteSave())) throw new Error("Couldn't delete the cloud save — try again.");
  await signOut();
  coord.forgetCloud();
}

/** Switch providers = a clean break (no account-linking, design.md §6): fully disconnect
 *  the current one, then redirect to the new one's OAuth. Disconnecting first means an
 *  abandoned OAuth lands back signed-out and clean, never half-switched. */
export async function switchProvider(coord: Coordinator, toProviderId: string): Promise<void> {
  await disconnect(coord);
  startSignIn(toProviderId);
}

// ── sync ────────────────────────────────────────────────────────────────────

/**
 * Load-time reconcile (design.md §5) — runs the full `syncNow` once per app load.
 *
 * This is the bounded push-on-OPEN compromise (a variant of §5's push-on-close): an
 * ordinary connected load spends a single "free credit" — if local is dirty it pushes
 * UP (CAS), so a user opening the planner on a second device sees a reassuringly-current
 * plan without lifting a finger; mostly a placebo for peace of mind. Clean local just
 * fast-forwards a moved cloud; both-moved raises a conflict. The cap is structural —
 * exactly ONE reconcile per load — so this never broadens into always-push (§10, the $0
 * keystone). A fresh connect (the OAuth callback) takes this same path — first-auth
 * migration just rides the post-redirect reload, no URL marker needed. Signed-out fails
 * soft (a 401 surfaces as `error`, no push lands), so the "if connected" gate is implicit
 * in the transport.
 */
export async function reconcileOnLoad(coord: Coordinator): Promise<SyncResult> {
  return syncNow(coord);
}

// ── re-exports: the rest of the cloud surface, one import path for the UI ──────

/** Who is this session? (signed-out on any error). */
export { fetchAuth, CLOUD_PROVIDERS } from "./client.ts";
export type { AuthState, CloudProvider } from "./client.ts";

/** The manual reconcile (the Sync button) + pick-a-side conflict resolution. */
export { syncNow, keepCloud, keepLocal } from "./sync.ts";
export type { CloudConflict, PlanFacts, SyncResult } from "./sync.ts";
