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
