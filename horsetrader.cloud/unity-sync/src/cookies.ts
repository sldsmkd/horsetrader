/** Minimal cookie read/write — no dep. */

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (name) out[name] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export interface CookieOpts {
  maxAge?: number; // seconds; 0 clears it
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export function serializeCookie(name: string, value: string, opts: CookieOpts = {}): string {
  const segs = [`${name}=${encodeURIComponent(value)}`, `Path=${opts.path ?? "/"}`];
  if (opts.maxAge !== undefined) segs.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) segs.push("HttpOnly");
  if (opts.secure) segs.push("Secure");
  if (opts.sameSite) segs.push(`SameSite=${opts.sameSite}`);
  return segs.join("; ");
}
