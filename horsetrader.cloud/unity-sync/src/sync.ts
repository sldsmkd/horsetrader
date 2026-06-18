/**
 * sync — Unity's R2 plan-sync, the second half of the Worker (auth is the first).
 *
 * One R2 object per account holds the serialised PlanDocument blob; the object's
 * ETag IS the sync rev (design.md §3 — no hand-rolled counter). The mechanism is
 * `git push` optimistic concurrency, expressed in plain HTTP conditionals that the
 * client speaks and we translate to R2 `onlyIf`:
 *
 *   GET  /api/sync                  → pull. 200 `{ etag, plan }` when present;
 *                                     404 when the account has no cloud save yet
 *                                     (the `cloud∅` arm of the migration matrix).
 *   PUT  /api/sync  If-None-Match:*  → first-ever write; 412 if one already exists.
 *   PUT  /api/sync  If-Match:<etag>  → fast-forward; 412 = someone moved it = CONFLICT.
 *
 * The rev (etag) is carried in the response BODY, never the `ETag` header: a CDN
 * in front (Cloudflare) may compress the response and rewrite the header to a WEAK
 * validator (`W/"…"`), which then never matches R2's strong etag on the next push
 * → a permanent-412 deadlock. The request `If-Match` header is fine (CDNs don't
 * touch request validators); `unquote` tolerates any quoting/weak form on it.
 *
 * The Worker is a thin authenticated proxy over a PRIVATE bucket (R2 is never
 * browser-facing). The blob is opaque to us — username masking and serialisation
 * are the client's concern (design.md §4); we store bytes and arbitrate revs.
 */
import type { Session } from "./session.ts";

export interface SyncEnv {
  BUCKET: R2Bucket;
}

// Anti-forgery ceiling only: a real save is ~1–2 KB and the local store caps at
// ~5 MB, so this never touches a legitimate client — it's a one-`if` reject for a
// hand-crafted request that bypasses localStorage (design.md §4).
const MAX_BLOB_BYTES = 5 * 1024 * 1024;

/** The R2 key for an account — one object holds the whole save. Identity = (provider, sub), no linking (design.md §6). */
const saveKey = (s: Session): string => `${s.provider}:${s.sub}`;

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

/** Strip the RFC-9110 quoting (and any weak prefix) off a client-sent ETag. */
const unquote = (etag: string): string => etag.replace(/^W\//, "").replace(/^"(.*)"$/, "$1");

export async function handleSync(request: Request, env: SyncEnv, session: Session): Promise<Response> {
  const key = saveKey(session);

  // ── pull ────────────────────────────────────────────────────────────────
  if (request.method === "GET") {
    const obj = await env.BUCKET.get(key);
    if (!obj) return json({ exists: false }, { status: 404 });
    // The rev travels in the BODY, not the `ETag` header: Cloudflare may compress
    // the response and rewrite the header to a WEAK validator (`W/"…"`), which then
    // never matches R2's strong etag on the next push → a permanent-412 deadlock.
    // `obj.etag` is the bare strong hash; the client echoes it straight back.
    return json({ etag: obj.etag, plan: await obj.json() });
  }

  // ── push ────────────────────────────────────────────────────────────────
  if (request.method === "PUT") {
    const ifMatch = request.headers.get("If-Match");
    const ifNoneMatch = request.headers.get("If-None-Match");

    // A push must declare its expected base rev: `If-Match` to fast-forward, or
    // `If-None-Match: *` to create. We never do an unconditional clobber. Both go to
    // R2 as a `Headers` object so R2's spec-compliant HTTP matcher does the compare;
    // we normalise the client's value to a clean STRONG quoted etag first (it may
    // arrive bare, quoted, or weak).
    let onlyIf: Headers;
    if (ifNoneMatch === "*") {
      onlyIf = new Headers({ "If-None-Match": "*" });
    } else if (ifMatch) {
      onlyIf = new Headers({ "If-Match": `"${unquote(ifMatch)}"` });
    } else {
      return json({ error: "precondition_required" }, { status: 428 });
    }

    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_BLOB_BYTES) {
      return json({ error: "blob_too_large", limit: MAX_BLOB_BYTES }, { status: 413 });
    }

    const result = await env.BUCKET.put(key, body, {
      onlyIf,
      httpMetadata: { contentType: "application/json" },
    });
    // Precondition failed → the rev moved under us. CAS reject = conflict (design.md §5).
    if (!result) return json({ error: "conflict" }, { status: 412 });

    // Bare etag in the body (same reason as pull) — never the CDN-transformable header.
    return json({ etag: result.etag });
  }

  return json({ error: "method_not_allowed" }, { status: 405 });
}
