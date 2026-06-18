/**
 * Google OAuth2 authorization-code flow with PKCE. Deliberately built from
 * `fetch` (auth-code "is just fetch calls" — design.md §6), so the only auth
 * dependency is `jose`, used to verify the returned id_token's signature against
 * Google's JWKS. We pick auth-code (not the GIS id_token shortcut) because it's
 * the ONE mechanism that also covers Discord later — see the spike-surfaced fork
 * in [[project_unity_save_load]].
 */
import { createRemoteJWKSet, jwtVerify } from "jose";
import { b64urlEncode } from "./encoding.ts";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
// Google issues `iss` as either form; accept both.
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64urlEncode(new Uint8Array(digest));
}

export function authorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const u = new URL(AUTH_ENDPOINT);
  u.searchParams.set("client_id", opts.clientId);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", opts.state);
  u.searchParams.set("nonce", opts.nonce);
  u.searchParams.set("code_challenge", opts.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

/** Exchange the auth code for tokens; returns the raw id_token JWT. */
export async function exchangeCode(opts: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
      code_verifier: opts.codeVerifier,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) throw new Error("token response had no id_token");
  return json.id_token;
}

/** Verify the id_token signature + iss/aud/nonce; return the stable subject. */
export async function verifyIdToken(idToken: string, clientId: string, nonce: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(idToken, JWKS, { issuer: ISSUERS, audience: clientId });
  if (payload.nonce !== nonce) throw new Error("nonce mismatch");
  if (!payload.sub) throw new Error("id_token had no sub");
  return { sub: payload.sub };
}
