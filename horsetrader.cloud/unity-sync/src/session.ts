/**
 * Stateless signed tokens: `base64url(json).base64url(hmac)`. Web Crypto
 * HMAC-SHA256, no dependency (design.md §6 — "session signing is native on
 * Workers"). Used for both the session cookie and the short-lived OAuth
 * transaction cookie (state/nonce/PKCE verifier carried across the redirect).
 *
 * `verify` is the trust gate: a bad signature, malformed token, or (for typed
 * callers) an expired `exp` returns null — never a thrown surprise on the hot path.
 */
import { b64urlEncode, b64urlDecode } from "./encoding.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function sign(payload: unknown, secret: string): Promise<string> {
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

export async function verify<T>(token: string, secret: string): Promise<T | null> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const ok = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    b64urlDecode(token.slice(dot + 1)),
    enc.encode(body),
  );
  if (!ok) return null;
  try {
    return JSON.parse(dec.decode(b64urlDecode(body))) as T;
  } catch {
    return null;
  }
}

/** The signed session payload — identity only, no PII (design.md §7). `provider`
 *  is a registry key (providers.ts): `google`, `discord`, … */
export interface Session {
  provider: string;
  sub: string;
  exp: number; // unix seconds
}

export async function readSession(token: string | undefined, secret: string): Promise<Session | null> {
  if (!token) return null;
  const s = await verify<Session>(token, secret);
  if (!s || typeof s.exp !== "number" || s.exp < Math.floor(Date.now() / 1000)) return null;
  return s;
}
