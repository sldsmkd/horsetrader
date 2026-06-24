/**
 * Supporter flag — the client mirror of the Worker's server-authoritative entitlement
 * stamp. It is NOT a plan field: unity-sync injects `plan.supporter = true` onto the
 * pulled save for an entitled account and strips it on push (horsetrader.cloud's
 * sync.ts), and `normaliseRemotePlan` whitelists it away — so the client never persists
 * or trusts a local copy. It re-reads the stamp off the cloud pull instead.
 *
 * A tiny observable boolean. `pullSave` (client.ts) is the single `GET /api/sync`
 * chokepoint, so it is the one place that watches the stamp: ON when the key is present
 * and true, OFF when it's absent (signed out, no cloud save, or simply not entitled).
 * The UI subscribes to re-render when it flips.
 */

type Listener = (on: boolean) => void;

let supporter = false;
const listeners = new Set<Listener>();

/** Current entitlement, as of the last cloud pull. */
export function isSupporter(): boolean {
  return supporter;
}

/** Toggle from a cloud pull's `supporter` stamp; notifies only on an actual change. */
export function setSupporter(on: boolean): void {
  if (on === supporter) return;
  supporter = on;
  for (const fn of listeners) fn(on);
}

/** Subscribe to supporter-state flips; returns an unsubscribe. */
export function onSupporterChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
