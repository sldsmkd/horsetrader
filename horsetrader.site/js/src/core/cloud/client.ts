/**
 * The cloud transport seam — the browser's thin client for the unity-sync Worker.
 * Same-origin in production (the Worker is routed on the site host), so every
 * call is a relative `/api/*` with `credentials: "include"` to carry the
 * first-party session cookie. This is the ONLY place the FE knows the cloud API
 * shape; auth lives here now, plan sync (`/api/sync`) will join it.
 *
 * Unproven / un-graduated: only the beta surface uses this today (design.md §9 —
 * Unity stays in the isolation chamber until it earns the main path). Nothing
 * here touches the persistence coordinator.
 */

export interface CloudIdentity {
  provider: string;
  sub: string;
}

export type AuthState =
  | { authenticated: true; identity: CloudIdentity }
  | { authenticated: false };

/** Who is this session? Resolves to signed-out on any error (network, 401, …). */
export async function fetchAuth(): Promise<AuthState> {
  try {
    const res = await fetch("/api/me", { credentials: "include" });
    if (!res.ok) return { authenticated: false };
    const body = (await res.json()) as { authenticated?: boolean; provider?: string; sub?: string };
    if (body.authenticated && body.provider && body.sub) {
      return { authenticated: true, identity: { provider: body.provider, sub: body.sub } };
    }
    return { authenticated: false };
  } catch {
    return { authenticated: false };
  }
}

/** Kick off the OAuth redirect (full-page navigation — the Worker drives it). */
export function startGoogleSignIn(): void {
  window.location.assign("/api/auth/google/start");
}

/** Clear the cloud session. Best-effort; never throws. */
export async function signOut(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {
    /* signed-out is signed-out — ignore transport errors */
  }
}

// ── plan sync: the ETag-CAS transport over `/api/sync` ──────────────────────
// The Worker stores one save object per account; its ETag is the rev. The sync
// layer (lastSyncedEtag/dirty, triggers, conflict dialog) builds on these two
// primitives — they only move bytes + the ETag, no reconciliation policy here.

/** Pull result: `exists:false` is the empty-cloud case (Worker 404), not an error. */
export type PullResult =
  | { exists: true; etag: string | null; doc: unknown }
  | { exists: false };

/** Pull the account's save blob + its rev. The Worker carries the etag in the BODY
 *  (not the `ETag` header — a CDN may weaken that, breaking the next push's CAS). */
export async function pullSave(): Promise<PullResult> {
  const res = await fetch("/api/sync", { credentials: "include" });
  if (res.status === 404) return { exists: false };
  if (!res.ok) throw new Error(`pull failed: ${res.status}`);
  const body = (await res.json()) as { etag: string | null; plan: unknown };
  return { exists: true, etag: body.etag, doc: body.plan };
}

/** Push outcome: a 412 is the CAS reject = conflict, surfaced as data not a throw. */
export type PushResult =
  | { ok: true; etag: string | null }
  | { ok: false; conflict: boolean; status: number };

/**
 * Conditionally push the save. `baseEtag` = the rev we believe we're updating:
 * a string → `If-Match` (fast-forward); `null` → `If-None-Match: *` (first write).
 * Anything but success returns `{ ok:false }`; `conflict` flags the 412 CAS reject.
 */
export async function pushSave(doc: unknown, baseEtag: string | null): Promise<PushResult> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (baseEtag) headers["If-Match"] = baseEtag;
  else headers["If-None-Match"] = "*";
  const res = await fetch("/api/sync", {
    method: "PUT",
    credentials: "include",
    headers,
    body: JSON.stringify(doc),
  });
  if (res.ok) {
    const body = (await res.json()) as { etag: string | null };
    return { ok: true, etag: body.etag };
  }
  return { ok: false, conflict: res.status === 412, status: res.status };
}
