/** base64url helpers (RFC 4648 §5, no padding) over raw bytes. */

export function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(input: string): Uint8Array {
  const pad = input.length % 4 ? "=".repeat(4 - (input.length % 4)) : "";
  const bin = atob(input.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A URL-safe random token (default 256 bits): state, nonce, PKCE verifier. */
export function randomToken(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64urlEncode(a);
}
